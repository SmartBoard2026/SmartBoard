import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v2.9/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cachedPublicKey: CryptoKey | null = null;

async function getSupabasePublicKey(): Promise<CryptoKey> {
  if (cachedPublicKey) return cachedPublicKey;

  const jwksUrl = `${Deno.env.get("SUPABASE_URL")}/auth/v1/.well-known/jwks.json`;
  const resp = await fetch(jwksUrl);
  if (!resp.ok) throw new Error("Impossibile recuperare JWKS");
  const { keys } = await resp.json();

  const jwk = keys.find((k: any) => k.alg === "ES256" || k.kty === "EC");
  if (!jwk) throw new Error("Chiave ES256 non trovata nel JWKS");

  cachedPublicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );

  return cachedPublicKey;
}

async function verifyToken(authHeader: string): Promise<string> {
  const token = authHeader.replace("Bearer ", "");
  const publicKey = await getSupabasePublicKey();
  const payload = await verify(token, publicKey, { algorithms: ["ES256"] });
  const user_id = payload.sub;
  if (!user_id) throw new Error("sub mancante nel token");
  return user_id as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), { status: 401, headers: corsHeaders });
    }

    let user_id: string;
    try {
      user_id = await verifyToken(authHeader);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Token non valido: " + e.message }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let status = "in_progress";
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      status = body.status ?? "in_progress";
    } else {
      const url = new URL(req.url);
      status = url.searchParams.get("status") ?? "in_progress";
    }

    const { data, error } = await supabase
      .from("games")
      .select("id, title, status, winner, created_at")
      .eq("user_id", user_id)
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, games: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});