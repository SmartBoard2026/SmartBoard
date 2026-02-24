// supabase/functions/_shared/auth.ts
import { verify } from "https://deno.land/x/djwt@v2.9/mod.ts";

let cachedPublicKey: CryptoKey | null = null;

export async function getSupabasePublicKey(): Promise<CryptoKey> {
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

export async function verifyToken(authHeader: string): Promise<string> {
  const token = authHeader.replace("Bearer ", "");
  const publicKey = await getSupabasePublicKey();
  const payload = await verify(token, publicKey, { algorithms: ["ES256"] });
  const user_id = payload.sub;
  if (!user_id) throw new Error("sub mancante nel token");
  return user_id as string;
}
