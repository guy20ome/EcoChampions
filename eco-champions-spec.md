Repository Status

The Ecology Champions platform (formerly 2026 Environmental Impact Tracker) is a collaborative and gamified system where users:

    Track sustainability efforts (e.g., CO₂, plastic use)
    Compete in category-based leaderboards (country, location, lifestyle, wealth)
    Share actionable strategies for top performers
    Evaluate community-submitted explanations for authenticity
    Maintain transparency through public explanations and moderation

Current state: Core concept defined but no code exists yet. Implementation will evolve based on user needs and deployment constraints.
I. Core Philosophy

Progressive enhancement: Start with the simplest viable product (MVP) and add complexity only when needed.

    Prioritize a stable core before introducing gamification or moderation features.
    Use user feedback to drive implementation direction.

II. User-Centric Design

Navigation & Experience:

    Minimal steps: Submit data → View leaderboards → Engage with explanations
    No invented barriers: Users shouldn’t face obstacles unrelated to core goals (e.g., accreditation-first systems)
    Public explanations: Encourage learning through visible, editable justifications for top performers

III. Anti-Cheating Principles

Address cheating only when evidence emerges (e.g., sandbagging patterns) via:

    5% random audits (triggered annually, not monthly)
    Community flagging for manual verification
    No automatic penalties until verified misconduct

IV. Development Roadmap (Problem-Driven, Not Predefined)
Phase 1: MVP (Weeks 1–4)

Goal: Users can track and compare their sustainability data
Features:

    Registration/login (email/password)
    Profile setup (country [ISO 3166], city)
    Monthly pollution logging (dropdown of indicators + value)
    Global/regional leaderboards (ascending order)
    Leaderboard opt-out toggle
    Technical needs: Basic auth, logging, sorting
    Avoid: Categories, explanations, or moderation

Phase 2: Categories & Feeds (Weeks 5–8)

Goal: Enable context-aware competition and strategy sharing
Features:

    Users self-identify categories (country, lifestyle cluster)
    Category-specific leaderboards (default view)
    Top 3 strategy feed: Visible explanations from leaders (editable)
    Simple flagging button on explanations
    Technical needs: Filtering, feeds, admin controls
    Avoid: Mandatory explainations or audits

Phase 3: Explanations & Moderation (Weeks 9–12)

Goal: Deepen community trust and accountability
Features:

    Mandatory explanations only for top 3 (48‑hour deadline per leaderboard)
    Public explanation visibility/profile integration
    Community review: Users vote/flag explanations for quality
    Moderation dashboard for flagged content
    Audit tool for admin oversight
    Technical needs: Deadlines, notifications, broadcast system
    Key Insight: Enforcement should reward transparency, not punish users

Phase 4: Scaling & Feedback (Ongoing)

Goal: Iterate based on real-world usage
Evaluations:

    Weekly compliance rates: Do top 3 users provide explanations?
    Flag tracking: Are reports surfacing real issues?
    User surveys: Are explanations improving practices?
    Prioritization: Address gaps first (e.g., add weightings if regions are mismatched)

V. Technical Stack (Scaling-First, Full-Stack TypeScript)

Design goal: keep the whole stack in the JS/TS ecosystem (full-stack friendly, matches the React frontend) while choosing components that scale from a single box to multi-node/cloud without a rewrite.

Database (Primary store):

    MariaDB (already installed on your Linux box)
        Use it instead of PostgreSQL for all durable relational data.
        Schema will include: users, countries, cities, pollution_logs, categories, explanations, reports, moderation_actions, auth_tokens, rankings
        Example init command:

        mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS ecology_champions; use ecology_champions; CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, username VARCHAR(100), country_id INT, city_id INT, opt_out_leaderboard BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"

Cache / Queue / Hot Data (Redis):

    Redis (single biggest scaling lever for this app's access pattern)
        Sorted sets for live leaderboard reads (avoids ORDER BY ... LIMIT on every request)
        Rate limiting and short-lived session/refresh-token store
        Queue backend for the 5% annual audit jobs and explanation-deadline notifications (BullMQ)
        Optional cache layer in front of category-filtered leaderboard queries

Backend:

    Node.js with Fastify (schema-first, JSON Schema validation, ~3x Express throughput, plugin system)
        Use TypeScript across the backend (shared types with the frontend).
        Routes: /auth, /users, /pollution, /leaderboards, /explanations, /reports
        Connect to MariaDB via the mysql2/promise package (connection pooling).
        Connect to Redis via the ioredis package.
        Authentication: JWT (access tokens) with refresh tokens stored in MariaDB's auth_tokens table; Redis for token blacklist / rate limiting.
        Leaderboard strategy: writes update a pre-materialized rankings table in MariaDB AND push into Redis sorted sets; reads are served from Redis with MariaDB as source of truth.
        Background jobs (audits, deadline notifications) via BullMQ backed by Redis.
        Note on Express: Express was considered and dropped because it lacks built-in schema validation and is ~3x slower than Fastify. If a heavier, more structured framework is later needed (DI, modules, OpenAPI), migrate Fastify to NestJS rather than back to Express.

Frontend:

    React with Vite (TypeScript) – SPA, runs locally on port 3000
        Calls the backend API using a typed client (e.g., axios or fetch + zod for response validation)
        Components: Dashboard, Leaderboard, ExplanationFeed, FlagButton
        Chosen as SPA (not Next.js SSR) because the app is auth-gated and has no public/indexable pages; revisit to Next.js/Remix only if public, SEO-indexed pages become a requirement.

Hosting / Deployment (Containerized from day one):

    Docker Compose is the local AND production runtime (identical environments = easy future scale-out)
        Services: db (MariaDB), redis, api (Fastify), frontend (Vite dev / nginx-served static build)
        Run the compose stack on your Linux box (e.g., Ubuntu 22.04).
        No cloud hosting needed – you control ports, TLS (via Let’s Encrypt or self‑signed), and firewall rules.
        Optional Nginx reverse‑proxy in front of the api + frontend services for static assets and SSL termination.
        Keeping containers from day one means local dev, the Linux box, and a future cloud deploy use the same images.

Development Workflow:

    Clone the repo on your Linux box
    Install Node.js (≥18), npm, Docker, and Docker Compose
    Copy .env.example to .env and fill in DB/Redis credentials and JWT secrets
    Create the MariaDB schema using the provided SQL files (schema/*.sql) – the db service applies them on first start
    Run npm install in /api and /frontend, or docker compose build
    npm run dev (or docker compose up) – starts db, redis, the Fastify API, and the Vite dev server together
    Access the app at http://<your‑linux‑box-ip>:3000 from any browser on the same network

Scaling Path (when you outgrow a single box):

    The compose services are already independently deployable as container images.
    Move the db to a managed MariaDB/cloud instance when write load increases.
    Run multiple api replicas behind a load balancer (Redis-backed sessions make this safe).
    Redis sorted sets already isolate hot leaderboard reads; add a Redis cluster if leaderboards dominate traffic.
    Swap the single Nginx instance for a load balancer + TLS termination for public access.

VI. Open Questions (To Be Addressed Early)

    Audit thresholds: Should 5 % be adjusted based on user growth?
    Explanation visibility: Should users opt‑in/out of sharing top‑3 explanations publicly?
    Weighting logic: Should country‑level weightings correlate with baseline pollution metrics?

VII. Non‑Negotiables

    No user blocks until demonstrated misuse (flagging triggers investigation, not penalties)
    Data privacy: Countries/wealth fields must never be mandatory
    Leaderboard integrity: Data sorting must never be arbitrary or incentivized unfairly
