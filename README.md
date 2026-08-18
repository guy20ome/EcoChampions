# Ecology Champions

Collaborative, gamified sustainability tracking platform. Users track monthly pollution data, compete on global/regional leaderboards (ascending order), and opt out of leaderboards at will.

Phase 1 MVP implements: email/password auth, profile (country/city), monthly pollution logging, global/regional leaderboards, and the leaderboard opt-out toggle.

## Tech stack

- **Database:** MariaDB (relational source of truth)
- **Cache / hot data / queue:** Redis (sorted sets for live leaderboards, token store, BullMQ jobs later)
- **Backend:** Node.js + Fastify (TypeScript), JWT auth, `mysql2`, `ioredis`
- **Frontend:** React + Vite (TypeScript)
- **Runtime:** Docker Compose (db, redis, api, frontend) — identical for local dev, the Linux box, and future cloud

See [`eco-champions-spec.md`](./eco-champions-spec.md) for the full specification and roadmap.

## Quick start (Docker Compose)

```bash
cp .env.example .env           # then edit the secrets (JWT_*, MARIADB_*)
docker compose up --build
# Frontend: http://localhost:3000   API: http://localhost:4000
```

The MariaDB container applies `schema/001_init.sql` automatically on first start (creates tables and seeds countries + indicators).

## Local dev (without containers)

```bash
npm install                    # installs workspaces (api, frontend)
npm run dev                    # runs API (:4000) + Vite (:3000) concurrently
```

You still need a reachable MariaDB and Redis; point the `.env` variables at them (e.g. `MARIADB_HOST=localhost REDIS_HOST=localhost`). Apply the schema manually if not using the container:

```bash
mysql -u root -p < schema/001_init.sql
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start API + frontend concurrently (local dev) |
| `npm run build` | Build both packages |
| `npm run typecheck` | Typecheck both packages |

## Project layout

```
api/        Fastify + TypeScript backend
  src/
    config.ts, db.ts, redis.ts
    auth/      password hashing, JWT plugin, refresh tokens
    routes/    auth, users, pollution, leaderboards
frontend/   React + Vite (TypeScript)
  src/
    api/      typed API client + types
    auth/     AuthProvider context
    views/    AuthPage, Dashboard, LogPollution, Leaderboard
schema/      MariaDB init SQL (auto-applied by the db container)
docker-compose.yml
.env.example
```
