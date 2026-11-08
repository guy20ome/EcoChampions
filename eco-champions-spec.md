# Ecology Champions Specification

Collaborative, gamified sustainability tracking platform where users track monthly pollution data, compete on leaderboards, share event explanations, and discuss strategies on a community dashboard wall.

---

## 1. Core Philosophy

**Progressive enhancement**: Start with the simplest viable product (MVP) and add complexity only when needed.
- Prioritize a stable core before introducing gamification or moderation features.
- Use user feedback to drive implementation direction.

**User-Centric Design**:
- Minimal steps: Submit data → View leaderboards → Engage with explanations
- No invented barriers: Users shouldn’t face obstacles unrelated to core goals (e.g., accreditation-first systems)
- Public explanations: Visible, editable justifications for top performers

**Anti-Cheating Principles**: Address cheating only when evidence emerges (e.g., sandbagging patterns) via:
- 5% random audits (triggered annually, not monthly)
- Community flagging for manual verification
- No automatic penalties until verified misconduct

**Non-Negotiables**:
- No user blocks until demonstrated misuse (flagging triggers investigation, not penalties)
- Data privacy: Countries/wealth fields must never be mandatory
- Leaderboard integrity: Data sorting must never be arbitrary or incentivized unfairly

---

## 2. Implemented Features

### Phase 1 — MVP (Complete)
1. Registration/login (email/password) — JWT access tokens + refresh tokens stored in MariaDB
2. Profile setup (country [ISO 3166], city) — optional, never mandatory
3. Monthly pollution logging — single mode (one indicator) or grid mode (all 4 indicators at once)
4. Combined leaderboard — ranked by sum of all 4 indicator values (ascending); users must log all 4 to appear
5. Individual indicator leaderboards — ascending order (best first)
6. Global/regional leaderboards (filter by country ISO)
7. Leaderboard opt-out toggle

### Phase 2 — Event Explanations & Discussion Wall (Complete)
1. **Auto-triggered event explanations**: When a user submits their first monthly report or has a significant increase/decrease (≥25% change vs previous month) in an indicator, the system creates a draft event explanation
2. **Dashboard wall** (`/wall`): Feed of all published explanations with color-coded event badges
3. **Pending status**: Users see a reminder when they have logged data but haven't posted an explanation for the current period
4. **Manual explanation posting**: Users can post explanations anytime via the wall form
5. **Threaded comments/discussion**: Users can comment on explanations and reply to comments (replies are threaded)
6. **Event type badges**: Color-coded badges (green = first report, red = significant increase, blue = significant decrease)

---

## 3. Technical Stack

| Layer | Technology |
|-------|------------|
| Database | MariaDB 11 |
| Cache / Queue | Redis 7 |
| Backend | Node.js + Fastify (TypeScript) |
| Auth | JWT access tokens + refresh tokens in MariaDB |
| Frontend | React + Vite (TypeScript) |
| Runtime | Docker Compose (db, redis, api, frontend) |

### Backend Routes

| Route | Description |
|-------|-------------|
| `POST /auth/register` | Register a new user |
| `POST /auth/login` | Log in, returns access + refresh tokens |
| `POST /auth/refresh` | Refresh access token |
| `GET /auth/me` | Current user profile |
| `GET /users/me` | Get current user |
| `PATCH /users/me` | Update profile (country, city, opt-out) |
| `GET /users/countries` | List ISO 3166 countries |
| `GET /users/cities?country_id=` | List cities for a country |
| `GET /users/indicators` | List pollution indicators |
| `POST /pollution` | Upsert a single pollution log |
| `POST /pollution/bulk` | Bulk upsert multiple logs for one period |
| `GET /pollution?year=&month=` | List current user's logs |
| `GET /leaderboards?indicator_id=&year=&month=&country=&limit=` | Individual indicator leaderboard |
| `GET /leaderboards/combined?year=&month=&country=&limit=` | Combined leaderboard |
| `POST /explanations` | Create an event explanation |
| `GET /explanations` | List published explanations (filter by user, event_code, year, month) |
| `GET /explanations/types` | List event types |
| `GET /explanations/pending` | Check pending explanation status |
| `GET /explanations/:id/comments` | List comments for an explanation |
| `POST /explanations/:id/comments` | Add a comment or reply |

### Database Schema Files

| File | Contents |
|------|----------|
| `schema/001_init.sql` | Phase 1: users, countries, cities, pollution_indicators, pollution_logs, rankings, auth_tokens |
| `schema/002_explanations.sql` | Phase 2: explanation_events, event_explanations, explanation_comments, dashboard_wall view |

---

## 4. Deployment

### Docker Compose (recommended)
```bash
cp .env.example .env    # edit JWT_*, MARIADB_* secrets
docker compose up --build
# Frontend: http://localhost:3000   API: http://localhost:4000
```

### Schema
The MariaDB container applies `schema/001_init.sql` automatically on first start. `schema/002_explanations.sql` must be applied manually if the database already existed:

```bash
docker exec ecochampions-db-1 mysql -uroot -p$MARIADB_ROOT_PASSWORD ecology_champions < schema/002_explanations.sql
```

---

## 5. Local Development

```bash
npm install                  # installs workspaces (api, frontend)
npm run dev                  # runs API (:4000) + Vite (:3000) concurrently
```

Requires reachable MariaDB and Redis. Point `.env` at them:
```bash
MARIADB_HOST=localhost REDIS_HOST=localhost
npm install
mysql -u root -p < schema/001_init.sql
mysql -u root -p < schema/002_explanations.sql
npm run dev
```

Access at `http://localhost:3000` (Vite proxy forwards `/api` to `http://localhost:4000`).

---

## 6. Project Layout

```
api/           Fastify + TypeScript backend
  src/
    config.ts, db.ts, redis.ts
    auth/        password hashing, JWT plugin, refresh tokens
    routes/      auth, users, pollution, leaderboards, explanations
    services/    explanationEvents.ts (event detection logic)
frontend/      React + Vite (TypeScript)
  src/
    api/         typed API client + types
    auth/        AuthProvider context
    components/  ExplanationComments.tsx
    views/       AuthPage, Dashboard, LogPollution, Leaderboard, Settings, DashboardWall
schema/        MariaDB init SQL (001_init.sql, 002_explanations.sql)
docker-compose.yml
.env.example
CLAUDE.md
eco-champions-spec.md
README.md
```

---

## 7. Notes on Duplicate Documentation

`CLAUDE.md` and `eco-champions-spec.md` overlap heavily. `CLAUDE.md` is the project instruction file checked into the repo for Claude Code; `eco-champions-spec.md` is the human-readable specification. Both should stay in sync; when in doubt, `eco-champions-spec.md` reflects the current state of implementation.
