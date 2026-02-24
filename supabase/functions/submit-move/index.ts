// supabase/functions/submit-move/index.ts
import { OpenAPIHono, createRoute, z } from "https://esm.sh/@hono/zod-openapi@0.16.0";
import { swaggerUI } from "https://esm.sh/@hono/swagger-ui@0.4.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Chess } from "https://esm.sh/chess.js@1.0.0";
import { verifyToken } from "../_shared/auth.ts";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const SubmitMoveBody = z.object({
  game_id: z.string().uuid(),
  notation: z.string().min(1, "La notazione è obbligatoria"),
});

const MoveResponse = z.object({
  success: z.boolean(),
  fen: z.string(),
  game_over: z.boolean(),
  winner: z.string().nullable(),
  message: z.string(),
});

const ErrorResponse = z.object({
  error: z.string(),
});

// ─── Route ────────────────────────────────────────────────────────────────────

const route = createRoute({
  method: "post",
  path: "/submit-move",
  summary: "Invia una mossa",
  description: "Invia una mossa in notazione algebrica per una partita in corso.",
  tags: ["Moves"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: SubmitMoveBody } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: MoveResponse } },
      description: "Mossa inviata con successo",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Mossa non valida o parametri mancanti",
    },
    401: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Non autorizzato",
    },
    404: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Partita non trovata o già terminata",
    },
    500: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Errore interno del server",
    },
  },
});

// ─── App ─────────────────────────────────────────────────────────────────────

const app = new OpenAPIHono();

app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("Access-Control-Allow-Origin", "*");
  c.res.headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
});

app.options("*", (c) => c.text("ok", 200));

app.doc("/submit-move/openapi.json", {
  openapi: "3.0.0",
  info: { title: "Submit Move API", version: "1.0.0" },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
});

app.get("/submit-move/docs", swaggerUI({ url: "/submit-move/openapi.json" }));

app.openapi(route, async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Non autorizzato" }, 401);

  let user_id: string;
  try {
    user_id = await verifyToken(authHeader);
  } catch (e) {
    return c.json({ error: "Token non valido: " + e.message }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { game_id, notation } = c.req.valid("json");

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, status, user_id")
    .eq("id", game_id)
    .eq("user_id", user_id)
    .eq("status", "in_progress")
    .single();

  if (gameError || !game) {
    return c.json({ error: "Partita non trovata o già terminata" }, 404);
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
    return c.json({ error: "Mossa non valida: " + notation }, 400);
  }

  const newFen = chess.fen();
  const { error: insertError } = await supabase.from("moves").insert({
    game_id,
    move_number: nextMoveNumber,
    notation,
    fen: newFen,
    created_at: new Date().toISOString(),
  });
  if (insertError) return c.json({ error: String(insertError) }, 500);

  let gameOver = false;
  let winner: string | null = null;
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

  return c.json({ success: true, fen: newFen, game_over: gameOver, winner, message });
});

app.notFound((c) => c.json({ error: "not found", path: c.req.path }, 404));

Deno.serve(app.fetch);
