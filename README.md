# Ecology Champions

Collaborative, gamified sustainability tracking platform. Users track monthly pollution data, compete on global/regional leaderboards (ascending order), and opt out of leaderboards at will. When users submit their first report or experience a significant indicator change (≥25%), they are prompted to post an explanation on a community dashboard wall where others can comment and discuss.

## Event Explanations & Discussion Wall

Auto-triggered explanations are created when a user logs their first monthly report or when an indicator changes by ≥25% compared to the previous month. These appear on the **dashboard wall** (`/wall`) as a feed with color-coded event badges, pending status reminders, threaded comments, and a manual explanation-posting form.

### Features
- **Auto-triggered explanations**: `first_report`, `significant_increase`, `significant_decrease` events detected automatically after logging
- **Dashboard wall**: feed of published explanations, ordered by recency
- **Pending status**: reminder when user has logged data but hasn't posted an explanation
- **Threaded comments**: reply to comments, build discussion threads
- **Event type badges**: green=first report, red=increase, blue=decrease

### API Endpoints
| Method | Path | Description |
| --- | --- | --- |
| GET | `/explanations` | List published explanations (filter by user, event_code, year, month) |
| GET | `/explanations/:id/comments` | List comments for an explanation |
| POST | `/explanations/:id/comments` | Add a comment or reply |
| GET | `/explanations/pending` | Check if current user has a pending explanation |
| GET | `/explanations/types` | List all event types |
| POST | `/explanations` | Create an explanation manually |

See [`eco-champions-spec.md`](./eco-champions-spec.md) for full design details, architecture, and roadmap.

## Tech stack
- **Database:** MariaDB (relational source of truth)
- **Cache:** Redis (sorted sets for live leaderboards, token store)
- **Backend:** Node.js + Fastify (TypeScript), JWT auth, mysql2, ioredis
- **Frontend:** React + Vite (TypeScript)
- **Runtime:** Docker Compose (db, redis, api, frontend)

## Quick start (Docker Compose)
```bash
cp .env.example .env           # edit JWT_*, MARIADB_* secrets
docker compose up --build
# Frontend: http://localhost:3000   API: http://localhost:4000
```

The MariaDB container applies `schema/001_init.sql` automatically on first start. If the database already exists, apply Phase 2 schema manually:
```bash
docker exec ecochampions-db-1 mysql -uroot -p$MARIADB_ROOT_PASSWORD ecology_champions < schema/002_explanations.sql
```

## Local dev
```bash
npm install                  # installs workspaces (api, frontend)
npm run dev                  # runs API (:4000) + Vite (:3000) concurrently
mysql -u root -p < schema/001_init.sql
docker exec ecochampions-db-1 mysql -uroot -p$MARIADB_ROOT_PASSWORD ecology_champions < schema/002_explanations.sql
```

Access at `http://localhost:3000`. The Vite dev server proxies `/api` → `http://localhost:4000`.

## Scripts
| Command | Description |
| --- | --- |
| `npm run dev` | Start API + frontend concurrently |
| `npm run build` | Build both packages |
| `npm run typecheck` | Typecheck both packages |

## Project layout
```
api/            Fastify + TypeScript backend
  src/
    config.ts, db.ts, redis.ts
    auth/       password hashing, JWT plugin, refresh tokens
    routes/     auth, users, pollution, leaderboards, explanations
    services/   explanationEvents.ts (event detection)
frontend/       React + Vite (TypeScript)
  src/
    api/        typed client + types
    auth/       AuthProvider context
    components/ ExplanationComments.tsx
    views/      AuthPage, Dashboard, LogPollution, Leaderboard, Settings, DashboardWall
schema/         MariaDB init SQL (001_init.sql, 002_explanations.sql)
docker-compose.yml
CLAUDE.md, eco-champions-spec.md, README.md
```
