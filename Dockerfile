# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Installiamo pnpm (il progetto usa pnpm-lock.yaml)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copiamo prima solo i file di dipendenze per sfruttare la cache di Docker
COPY package.json pnpm-lock.yaml ./

# Installiamo le dipendenze
RUN pnpm install --frozen-lockfile

# Copiamo il resto del codice sorgente
COPY . .

# Dichiariamo gli ARG e li esportiamo come ENV
# così Vite li vede durante il build tramite import.meta.env
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Costruiamo il progetto (output in /app/dist)
RUN pnpm build

# ─── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Rimuoviamo il sito di default di Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copiamo i file buildati dallo stage precedente
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiamo la nostra configurazione Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Esponiamo la porta 80
EXPOSE 80

# Avviamo Nginx in foreground (necessario per Docker)
CMD ["nginx", "-g", "daemon off;"]
