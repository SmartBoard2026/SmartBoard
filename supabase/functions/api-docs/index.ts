import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "https://esm.sh/@asteasolutions/zod-to-openapi@7.0.0";

import {
  LoginSchema,
  LoginQuerySchema, // Assicurati di averlo in schemas.ts come visto prima!
  CreateGameSchema,
  GetGamesSchema,
  SubmitMoveSchema,
  ResignGameSchema,
  GetGamesResponseSchema,
  SuccessResponseSchema,
  MoveResponseSchema,
} from "../_shared/schemas.ts";

// 1. Inizializziamo il registro
const registry = new OpenAPIRegistry();

const BearerAuth = registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
});

// --- REGISTRAZIONE ROTTE ---

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
    200: { description: "Login riuscito" },
  },
});

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

// 2. Generiamo il JSON di OpenAPI
const generator = new OpenApiGeneratorV3(registry.definitions);
const doc = generator.generateDocument({
  openapi: "3.0.0",
  info: {
    title: "SmartBoard API",
    version: "1.0.0",
    description: "Documentazione interattiva per la scacchiera",
  },
  servers: [{ url: "https://gdiaotelevhqmesamrnx.supabase.co" }],
});

// 3. Creiamo l'HTML con Swagger UI
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SmartBoard API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>body { margin: 0; padding: 0; }</style>
</head>
<body>
  <div id="swagger-ui"></div>

  <!-- JSON separato, nessun problema di escape con </script> -->
  <script id="api-spec" type="application/json">
    ${JSON.stringify(doc)}
  </script>

  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      const spec = JSON.parse(document.getElementById('api-spec').textContent);
      window.ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
      });
    };
  </script>
</body>
</html>
`;

// 4. Serviamo la pagina
Deno.serve(async (req) => {
  return new Response(html, {
    status: 200,
    headers: new Headers({
      "Content-Type": "text/html; charset=utf-8",
    }),
  });
});
