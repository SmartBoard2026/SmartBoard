import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v2.9/mod.ts";
import { Chess } from "https://esm.sh/chess.js@1.0.0";

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

    const { game_id, notation } = await req.json();
    if (!game_id || !notation) {
      return new Response(JSON.stringify({ error: "game_id e notation sono obbligatori" }), { status: 400, headers: corsHeaders });
    }

    // Verifica che la partita appartenga all'utente
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id, status, user_id")
      .eq("id", game_id)
      .eq("user_id", user_id)
      .eq("status", "in_progress")
      .single();

    if (gameError || !game) {
      return new Response(JSON.stringify({ error: "Partita non trovata o già terminata" }), { status: 404, headers: corsHeaders });
    }

    const { data: lastMoveArr } = await supabase
      .from("moves")
      .select("*")
      .eq("game_id", game_id)
      .order("move_number", { ascending: false })
      .limit(1);

    const lastMove = lastMoveArr?.[0];
    const currentFen = lastMove?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const nextMoveNumber = (lastMove?.move_number ?? 0) + 1;

    const chess = new Chess(currentFen);
    let moveResult;
    try {
      moveResult = chess.move(notation);
      if (!moveResult) throw new Error("Mossa nulla");
    } catch {
      return new Response(JSON.stringify({ error: "Mossa non valida: " + notation }), { status: 400, headers: corsHeaders });
    }

    const newFen = chess.fen();
    const { error: insertError } = await supabase.from("moves").insert({
      game_id,
      move_number: nextMoveNumber,
      notation,
      fen: newFen,
      created_at: new Date().toISOString(),
    });
    if (insertError) throw insertError;

    let gameOver = false;
    let winner = null;
    let message = "Mossa " + notation + " inviata!";

    if (chess.isCheckmate()) {
      gameOver = true;
      winner = chess.turn() === "b" ? "white" : "black";
      message = "Scacco Matto! Vincitore: " + winner;
    } else if (chess.isDraw() || chess.isStalemate() || chess.isInsufficientMaterial() || chess.isThreefoldRepetition()) {
      gameOver = true;
      winner = "draw";
      message = "Partita terminata in patta.";
    }

    if (gameOver) {
      await supabase.from("games").update({ status: "completed", winner }).eq("id", game_id);
    }

    return new Response(
      JSON.stringify({ success: true, fen: newFen, game_over: gameOver, winner, message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});