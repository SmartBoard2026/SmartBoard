import { OpenAPIHono, createRoute, z } from "https://esm.sh/@hono/zod-openapi@0.16.0";
import { swaggerUI } from "https://esm.sh/@hono/swagger-ui@0.4.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyToken } from "../_shared/auth.ts";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreateGameBody = z.object({
  title: z.string().min(1, "Il titolo è obbligatorio"),
});

const GameResponse = z.object({
  success: z.boolean(),
  game: z.object({
    id: z.string().uuid(),
    title: z.string(),
    status: z.string(),
    user_id: z.string().uuid(),
    created_at: z.string(),
  }),
});

const ErrorResponse = z.object({
  error: z.string(),
});

// ─── App ─────────────────────────────────────────────────────────────────────

const app = new OpenAPIHono();

app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("Access-Control-Allow-Origin", "*");
  c.res.headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// CORS preflight
app.options("*", (c) => c.text("ok", 200, corsHeaders));

// ─── OpenAPI spec ─────────────────────────────────────────────────────────────
// Register at the FULL path Supabase passes to Hono
app.doc("/create-game/openapi.json", {
  openapi: "3.0.0",
  info: { title: "Create Game API", version: "1.0.0" },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
});

// ─── Swagger UI ───────────────────────────────────────────────────────────────
app.get(
  "/create-game/docs",
  swaggerUI({ url: "/create-game/openapi.json" })
);

// ─── Route ────────────────────────────────────────────────────────────────────

const route = createRoute({
  method: "post",
  path: "/create-game",
  summary: "Crea una nuova partita",
  description: "Crea una nuova partita in_progress per l'utente autenticato. Massimo 10 partite attive.",
  tags: ["Games"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: CreateGameBody } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: GameResponse } },
      description: "Partita creata con successo",
    },
    400: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Richiesta non valida o limite partite raggiunto",
    },
    401: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Non autorizzato",
    },
    500: {
      content: { "application/json": { schema: ErrorResponse } },
      description: "Errore interno del server",
    },
  },
});

// ─── Handler ──────────────────────────────────────────────────────────────────

app.openapi(route, async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ error: "Non autorizzato" }, 401, corsHeaders);
  }

  let user_id: string;
  try {
    user_id = await verifyToken(authHeader);
  } catch (e) {
    return c.json({ error: "Token non valido: " + e.message }, 401, corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { title } = c.req.valid("json");

  const { count } = await supabase
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user_id)
    .eq("status", "in_progress");

  if ((count ?? 0) >= 10) {
    return c.json({ error: "Limite massimo di 10 partite attive raggiunto" }, 400, corsHeaders);
  }

  const { data, error } = await supabase
    .from("games")
    .insert({ title: title.trim(), status: "in_progress", user_id })
    .select()
    .single();

  if (error) return c.json({ error: String(error) }, 500, corsHeaders);

  return c.json({ success: true, game: data }, 200, corsHeaders);
});

// ─── Serve ────────────────────────────────────────────────────────────────────

Deno.serve(app.fetch);
