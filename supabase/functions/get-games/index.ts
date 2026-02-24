// supabase/functions/get-games/index.ts
import { OpenAPIHono, createRoute, z } from "https://esm.sh/@hono/zod-openapi@0.16.0";
import { swaggerUI } from "https://esm.sh/@hono/swagger-ui@0.4.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyToken } from "../_shared/auth.ts";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const GameItem = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: z.string(),
  winner: z.string().nullable(),
  created_at: z.string(),
});

const GamesResponse = z.object({
  success: z.boolean(),
  games: z.array(GameItem),
});

const ErrorResponse = z.object({
  error: z.string(),
});

// ─── Route ────────────────────────────────────────────────────────────────────

const route = createRoute({
  method: "get",
  path: "/get-games",
  summary: "Lista partite",
  description: "Restituisce le partite dell'utente autenticato filtrate per stato.",
  tags: ["Games"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      status: z.string().optional().default("in_progress"),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: GamesResponse } },
      description: "Lista partite",
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

// ─── App ─────────────────────────────────────────────────────────────────────

const app = new OpenAPIHono();

app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("Access-Control-Allow-Origin", "*");
  c.res.headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
});

app.options("*", (c) => c.text("ok", 200));

app.doc("/get-games/openapi.json", {
  openapi: "3.0.0",
  info: { title: "Get Games API", version: "1.0.0" },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
});

app.get("/get-games/docs", swaggerUI({ url: "/get-games/openapi.json" }));

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

  const { status } = c.req.valid("query");

  const { data, error } = await supabase
    .from("games")
    .select("id, title, status, winner, created_at")
    .eq("user_id", user_id)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) return c.json({ error: String(error) }, 500);

  return c.json({ success: true, games: data });
});

app.notFound((c) => c.json({ error: "not found", path: c.req.path }, 404));

Deno.serve(app.fetch);
