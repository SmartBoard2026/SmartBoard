// supabase/functions/resign-game/index.ts
import { OpenAPIHono, createRoute, z } from "https://esm.sh/@hono/zod-openapi@0.16.0";
import { swaggerUI } from "https://esm.sh/@hono/swagger-ui@0.4.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyToken } from "../_shared/auth.ts";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const ResignGameBody = z.object({
  game_id: z.string().uuid(),
  resigning_player: z.enum(["white", "black"]),
});

const ResignResponse = z.object({
  success: z.boolean(),
  winner: z.string(),
  message: z.string(),
});

const ErrorResponse = z.object({
  error: z.string(),
});

// ─── Route ────────────────────────────────────────────────────────────────────

const route = createRoute({
  method: "post",
  path: "/resign-game",
  summary: "Abbandona una partita",
  description: "Il giocatore indicato abbandona la partita, l'avversario vince.",
  tags: ["Games"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: ResignGameBody } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ResignResponse } },
      description: "Partita abbandonata con successo",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Parametri non validi",
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

app.doc("/resign-game/openapi.json", {
  openapi: "3.0.0",
  info: { title: "Resign Game API", version: "1.0.0" },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
});

app.get("/resign-game/docs", swaggerUI({ url: "/resign-game/openapi.json" }));

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

  const { game_id, resigning_player } = c.req.valid("json");

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

  const winner = resigning_player === "white" ? "black" : "white";
  const { error: updateError } = await supabase
    .from("games")
    .update({ status: "completed", winner })
    .eq("id", game_id);

  if (updateError) return c.json({ error: String(updateError) }, 500);

  return c.json({
    success: true,
    winner,
    message: resigning_player + " ha abbandonato. Vincitore: " + winner,
  });
});

app.notFound((c) => c.json({ error: "not found", path: c.req.path }, 404));

Deno.serve(app.fetch);
