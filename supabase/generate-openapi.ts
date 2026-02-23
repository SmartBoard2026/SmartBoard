import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "https://esm.sh/@asteasolutions/zod-to-openapi@7.0.0";

import {
  LoginSchema,
  LoginQuerySchema,
  CreateGameSchema,
  GetGamesSchema,
  SubmitMoveSchema,
  ResignGameSchema,
  GetGamesResponseSchema,
  SuccessResponseSchema,
  MoveResponseSchema,
} from "./functions/_shared/schemas.ts";

const registry = new OpenAPIRegistry();

// AUTH HEADER riutilizzabile
const BearerAuth = registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
});

// --- LOGIN ---
registry.registerPath({
  method: "post",
  path: "/auth/v1/token",
  summary: "Login utente",
  tags: ["Auth"],
  request: {
    query: LoginQuerySchema,
    body: { content: { "application/json": { schema: LoginSchema } } },
  },
  responses: {
    200: {
      description: "Login riuscito, restituisce access_token",
      content: { "application/json": { schema: { type: "object", properties: { access_token: { type: "string" } } } } },
    },
  },
});

// --- CREATE GAME ---
registry.registerPath({
  method: "post",
  path: "/functions/v1/create-game",
  summary: "Crea una nuova partita",
  tags: ["Games"],
  security: [{ [BearerAuth.name]: [] }],
  request: {
    body: { content: { "application/json": { schema: CreateGameSchema } } },
  },
  responses: {
    200: { description: "Partita creata", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

// --- GET GAMES ---
registry.registerPath({
  method: "post",
  path: "/functions/v1/get-games",
  summary: "Lista partite attive",
  tags: ["Games"],
  security: [{ [BearerAuth.name]: [] }],
  request: {
    body: { content: { "application/json": { schema: GetGamesSchema } } },
  },
  responses: {
    200: { description: "Lista partite", content: { "application/json": { schema: GetGamesResponseSchema } } },
  },
});

// --- SUBMIT MOVE ---
registry.registerPath({
  method: "post",
  path: "/functions/v1/submit-move",
  summary: "Invia una mossa",
  tags: ["Moves"],
  security: [{ [BearerAuth.name]: [] }],
  request: {
    body: { content: { "application/json": { schema: SubmitMoveSchema } } },
  },
  responses: {
    200: { description: "Mossa inviata", content: { "application/json": { schema: MoveResponseSchema } } },
  },
});

// --- RESIGN GAME ---
registry.registerPath({
  method: "post",
  path: "/functions/v1/resign-game",
  summary: "Abbandona una partita",
  tags: ["Moves"],
  security: [{ [BearerAuth.name]: [] }],
  request: {
    body: { content: { "application/json": { schema: ResignGameSchema } } },
  },
  responses: {
    200: { description: "Partita abbandonata", content: { "application/json": { schema: SuccessResponseSchema } } },
  },
});

// --- GENERA IL FILE ---
const generator = new OpenApiGeneratorV3(registry.definitions);

const doc = generator.generateDocument({
  openapi: "3.0.0",
  info: {
    title: "SmartBoard API",
    version: "1.0.0",
    description: "API per la gestione delle partite SmartBoard",
  },
  servers: [{ url: "https://gdiaotelevhqmesamrnx.supabase.co" }],
});

await Deno.writeTextFile("./openapi.json", JSON.stringify(doc, null, 2));
console.log("✅ openapi.json generato!");

