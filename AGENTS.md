# AGENTS.md — Base44 Dev Environment

## Project Overview

Kavach Wallet — a non-custodial multi-chain crypto wallet (React/Vite frontend + Express API server).
pnpm monorepo with Node.js 22, TypeScript 5.9.

## Architecture

- **Frontend**: `artifacts/kavach-wallet` — Vite + React 19, served on port 5173 (mapped to host 3000). Calls `/api/...` relative paths, proxied to the API server via Vite's `server.proxy`.
- **API server**: `artifacts/api-server` — Express 5, esbuild-bundled, runs on port 5000. Proxies public crypto APIs (CoinGecko, OKX, LI.FI). No API keys required.
- **Database**: `lib/db` — PostgreSQL + Drizzle ORM. Schema is currently empty (`export {}`). `DATABASE_URL` is required at import time even though no tables exist yet.
- **Other frontends**: `artifacts/cavendish-wallet-review` and `artifacts/mockup-sandbox` exist but are not the primary app.

## Running the App

```sh
docker compose -f docker-compose.base44.yml up -d --build
```

- Web entry: http://localhost:3000
- API health: http://localhost:3000/api/healthz (proxied) or http://localhost:5000/api/healthz

## Services

| Service | Image | Port | Notes |
|---------|-------|------|-------|
| postgres | postgres:16-alpine | 5432 (internal) | DB for Drizzle ORM |
| setup | node:22-slim | — | One-shot `pnpm install --frozen-lockfile` |
| api-server | node:22-slim | 5000 (internal) | Express API, esbuild watch + `node --watch` for live reload |
| web | node:22-slim | 3000 (host) | Vite dev server with HMR |

## Key Details

- pnpm 10 is installed via `npm install -g pnpm@10` in each service.
- The `setup` service runs `pnpm install --frozen-lockfile` and must complete before `api-server` and `web` start.
- `build.mjs` supports a `--watch` flag (uses esbuild's context API) for live rebuilds.
- The Vite config proxies `/api` to `http://api-server:5000` (overridable via `API_URL` env var).
- Frontend requires `PORT` and `BASE_PATH` env vars (enforced by vite.config.ts).
- API server requires `PORT` env var (enforced by src/index.ts).
- No external secrets/API keys needed — all third-party APIs are public and keyless.

## Verification

1. `docker compose -f docker-compose.base44.yml ps` — all services should be up.
2. `curl http://localhost:3000` — should return the wallet HTML.
3. `curl http://localhost:3000/api/healthz` — should return `{"status":"ok"}`.
4. `curl http://localhost:3000/api/kavach/health` — should return `{"ok":true,...}`.
