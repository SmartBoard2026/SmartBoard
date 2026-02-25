# SmartBoard

SmartBoard è una dashboard amministrativa moderna e personalizzabile, costruita con tecnologie web all'avanguardia. L'interfaccia è progettata per essere reattiva e accessibile, offrendo un'esperienza utente fluida sia su desktop che su dispositivi mobili.

Il sito include supporto per la modalità chiara e scura, navigazione tramite sidebar integrata, ricerca globale e oltre 10 pagine preconfigurate. È inoltre disponibile il supporto RTL (Right-to-Left) per lingue che si scrivono da destra verso sinistra.

## Tech Stack

- **UI:** ShadcnUI (TailwindCSS + RadixUI)
- **Build Tool:** Vite
- **Routing:** TanStack Router
- **Linguaggio:** TypeScript
- **Autenticazione:** Clerk

## Installazione

```bash
git clone https://github.com/SmartBoard2026/SmartBoard.git
cd SmartBoard
pnpm install
pnpm run dev
```

## Avivare il progetto con Docker
1. Copia .env.example in .env e cambia le variabili di ambiente con i valori di supabase reali.
```bash
cp .env.example .env
```
2. Avvia con docker-compose:
```bash
bashdocker compose up --build
```
Il sito sarà disponibile su http://localhost:3000
3. Altri comandi utili:
```bash
bashdocker compose up --build -d    # avvia in background (detached)
docker compose down             # ferma e rimuove i container
docker compose logs -f          # vedi i log in tempo reale
```

## Licenza

Distribuito sotto licenza [MIT](./LICENSE).
