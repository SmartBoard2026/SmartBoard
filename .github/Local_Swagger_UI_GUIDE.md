# Local_Swagger_UI_GUIDE

# Local Swagger UI — Guida alla Configurazione

Questa guida descrive il processo completo per configurare una Swagger UI locale integrata con Supabase Edge Functions, includendo autenticazione JWT, generazione automatica della documentazione OpenAPI e deployment delle funzioni.

---

## Prerequisiti

Prima di procedere, assicurarsi di avere installato i seguenti strumenti:

```bash
npm install -g supabase
```

```bash
npx degit swagger-api/swagger-ui/dist swagger-ui
```

---

## 1. Inizializzazione del progetto Supabase

Eseguire i seguenti comandi in sequenza per inizializzare e collegare il progetto:

```bash
# Inizializza la directory supabase/ con il file config.toml
supabase init
```

```bash
# Autenticazione obbligatoria prima di effettuare il link
supabase login
```

```bash
# Collega il progetto locale a quello remoto
# Il project-ref è ricavabile dall'URL della Supabase Dashboard:
# https://supabase.com/dashboard/project/<project-ref>
supabase link --project-ref <project-ref>
```

---

## 2. Gestione delle Edge Functions

I comandi seguenti devono essere eseguiti dalla root directory di Supabase:

```bash
# Scarica tutte le Edge Functions del progetto
supabase functions download
```

```bash
# Scarica una singola Edge Function
supabase functions download <edge_function_name>
```

```bash
# Esegue il deploy di tutte le Edge Functions presenti in supabase/functions/
supabase functions deploy
```

```bash
# Esegue il deploy di una singola Edge Function
supabase functions deploy <edge_function_name>
```

---

## 3. Configurazione dell’autenticazione JWT

### 3.1 File `_shared/auth.ts`

All’interno della directory `supabase/functions/`, creare una cartella `_shared` contenente il file `auth.ts`. Questo modulo gestisce la verifica dei token JWT emessi da Supabase.

```tsx
// supabase/functions/_shared/auth.ts
import { verify } from "https://deno.land/x/djwt@v2.9/mod.ts";

let cachedPublicKey: CryptoKey | null = null;

/**
 * Recupera e memorizza nella cache la chiave pubblica dal JWKS endpoint di Supabase.
 * Utilizzare questa funzione esclusivamente per firme asimmetriche (ES256 o RS256).
 * Per firme simmetriche (HS256), utilizzare invece la variabile d'ambiente JWT_SECRET.
 */
export async function getSupabasePublicKey(): Promise<CryptoKey> {
  if (cachedPublicKey) return cachedPublicKey;

  const jwksUrl = `${Deno.env.get("SUPABASE_URL")}/auth/v1/.well-known/jwks.json`;

  const resp = await fetch(jwksUrl);
  if (!resp.ok) throw new Error("Impossibile recuperare il JWKS dal server");

  const { keys } = await resp.json();

  // Adattare il filtro in base all'algoritmo asimmetrico utilizzato:
  // - ES256 → k.alg === "ES256" || k.kty === "EC"
  // - RS256 → k.alg === "RS256" || k.kty === "RSA"
  const jwk = keys.find((k: any) => k.alg === "ES256" || k.kty === "EC");

  if (!jwk) throw new Error("Chiave ES256 non trovata nel JWKS");

  // Adattare i parametri in base all'algoritmo:
  // - ES256 → { name: "ECDSA", namedCurve: "P-256" }
  // - RS256 → { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }
  cachedPublicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );

  return cachedPublicKey;
}

/**
 * Verifica un token JWT estratto dall'header Authorization.
 * Restituisce il `sub` (user_id) contenuto nel payload se la verifica ha successo.
 */
export async function verifyToken(authHeader: string): Promise<string> {
  const token = authHeader.replace("Bearer ", "");
  const publicKey = await getSupabasePublicKey();

  // Aggiornare l'array degli algoritmi in base alla chiave importata:
  // es. ["ES256"] per chiavi EC, ["RS256"] per chiavi RSA
  const payload = await verify(token, publicKey, { algorithms: ["ES256"] });

  const user_id = payload.sub;
  if (!user_id) throw new Error("Campo 'sub' mancante nel payload del token");

  return user_id as string;
}
```

```typescript

```

### 3.2 Identificare l’algoritmo JWT del progetto

Per determinare il tipo di algoritmo utilizzato dal progetto, accedere alla **Supabase Dashboard** e navigare in **Settings → JWT Settings**:

| Indicatore nella dashboard | Algoritmo |
| --- | --- |
| Stringa alfanumerica lunga (singola chiave) | **HS256** — simmetrico |
| Presenza di una “Public Key” o certificato | **RS256** — asimmetrico |
| Riferimento a ECC / P-256 | **ES256** — asimmetrico |

### 3.3 Configurazione del `JWT_SECRET`

A differenza di `SUPABASE_URL` e `SUPABASE_ANON_KEY`, che vengono iniettate automaticamente nelle Edge Functions, il `JWT_SECRET` è strettamente confidenziale e deve essere caricato manualmente nei secrets del progetto tramite CLI:

```bash
supabase secrets set JWT_SECRET=inserisci-qui-il-jwt-secret-del-progetto
```

> Il JWT Secret è reperibile nella Supabase Dashboard in: **Project Settings → API → JWT Secret**.
> 

---

## 4. Struttura di una Edge Function compatibile con Swagger UI

Ogni Edge Function deve essere strutturata secondo i punti seguenti per consentire la generazione automatica della documentazione OpenAPI.

### 4.1 Import obbligatori

```tsx
import { OpenAPIHono, createRoute, z } from "https://esm.sh/@hono/zod-openapi@0.16.0";
import { swaggerUI } from "https://esm.sh/@hono/swagger-ui@0.4.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyToken } from "../_shared/auth.ts";
```

### 4.2 Definizione degli schema Zod

Ogni request body, query parameter e response deve essere definito tramite `z.object({...})`:

```tsx
// ─── Schema Definitions ───────────────────────────────────────────────────────

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
```

### 4.3 Inizializzazione dell’app con CORS middleware

Il middleware CORS deve essere registrato immediatamente dopo `new OpenAPIHono()`, prima di qualsiasi definizione di route:

```tsx
const app = new OpenAPIHono();

app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("Access-Control-Allow-Origin", "*");
  c.res.headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
});

app.options("*", (c) => c.text("ok", 200));
```

### 4.4 Route per la documentazione OpenAPI

Supabase rimuove il prefisso `/functions/v1` dalle richieste, ma mantiene il nome della funzione. Il path deve quindi essere `/<nome-funzione>/openapi.json`:

```tsx
app.doc("/nome-funzione/openapi.json", {
  openapi: "3.0.0",
  info: { title: "Nome API", version: "1.0.0" },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
});
```

### 4.5 Route per la Swagger UI

```tsx
app.get("/nome-funzione/docs", swaggerUI({ url: "/nome-funzione/openapi.json" }));
```

### 4.6 Definizione delle route con `createRoute`

```tsx
const route = createRoute({
  method: "post", // Metodo HTTP: get, post, put, delete, ecc.
  path: "/nome-funzione",
  security: [{ bearerAuth: [] }],
  request: { /* ... */ },
  responses: { /* ... */ },
});
```

### 4.7 Gestione dei 404 (opzionale, utile in fase di debug)

```tsx
app.notFound((c) => c.json({ error: "Not found", path: c.req.path }, 404));
```

### 4.8 Entry point Deno

```tsx
Deno.serve(app.fetch);
```

---

## 5. Configurazione della Swagger UI locale

Nel file `supabase/swagger-ui/swagger-initializer.js`, utilizzare la proprietà `urls` (array) al posto di `url` per abilitare il supporto a più API tramite menu a tendina:

```jsx
window.onload = function () {
  window.ui = SwaggerUIBundle({
    urls: [
      {
        url: "https://<project-ref>.supabase.co/functions/v1/<edge_function_1>/openapi.json",
        name: "Edge Function 1",
      },
      {
        url: "https://<project-ref>.supabase.co/functions/v1/<edge_function_2>/openapi.json",
        name: "Edge Function 2",
      },
    ],
    "urls.primaryName": "<primary_name>",
    dom_id: "#swagger-ui",
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: "StandaloneLayout",
  });
};
```

---

## 6. Struttura finale del progetto

```
supabase/
├── config.toml
├── functions/
│   ├── <edge_function_1>/
│   │   └── index.ts
│   ├── <edge_function_2>/
│   │   └── index.ts
│   └── _shared/
│       └── auth.ts
└── swagger-ui/
    └── swagger-initializer.js
```

---

## 7. Disabilitare la verifica JWT automatica di Supabase

Quando la verifica del token JWT viene gestita internamente dalla Edge Function, è necessario disabilitare la verifica automatica di Supabase per evitare conflitti. Aggiungere la seguente configurazione al file `config.toml` nella root directory di Supabase:

```toml
[functions.<edge_function_name>]
verify_jwt = false
```

---

## 8. Avvio della Swagger UI in locale

Una volta completata la configurazione, avviare il server locale con il comando:

```bash
npx serve .
```

La Swagger UI sarà disponibile all’indirizzo: **http://localhost:3000**