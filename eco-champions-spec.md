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

V. Technical Stack (Local Development / Linux Box Deployment)

Database:

    MariaDB (already installed on your Linux box)
        Use it instead of PostgreSQL for all data storage.
        Schema will include: users, countries, cities, pollution_logs, categories, explanations, reports, moderation_actions
        Example init command:

        mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS ecology_champions; use ecology_champions; CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, username VARCHAR(100), country_id INT, city_id INT, opt_out_leaderboard BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"

Backend:

    Node.js with Express.js (lightweight HTTP API)
        Routes: /auth, /users, /pollution, /leaderboards, /explanations, /reports
        Connect to MariaDB via the mysql2 npm package
        Simple middleware for JWT‑based authentication (tokens stored in an auth_tokens table)

Frontend:

    React with Vite (fast dev server) – runs locally on port 3000
        Calls the backend API using fetch or axios
        Components: Dashboard, Leaderboard, ExplanationFeed, FlagButton

Hosting / Deployment:

    Run everything on your Linux box (e.g., Ubuntu 22.04)
        Use systemd services for the backend Node process and the React dev server (or deploy via a single npm start script that builds the React app and serves it with Express)
        No cloud hosting needed – you control ports, TLS (via Let’s Encrypt or self‑signed), and firewall rules
        Optionally put an Nginx reverse‑proxy in front to serve static assets and handle SSL termination

Development Workflow:

    Clone the repo on your Linux box
    Install Node.js (≥18) and npm
    Create the MariaDB schema using the provided SQL files (schema/*.sql)
    Run npm install to pull dependencies
    npm run dev – starts both the Express API and the Vite dev server (concurrently)
    Access the app at http://<your‑linux‑box-ip>:3000 from any browser on the same network

Future Scaling (when you’re ready to go beyond the box):

    Containerize the stack with Docker Compose (services: db, api, frontend)
    Move the DB to a managed cloud instance if load increases
    Add an Nginx load balancer and enable TLS for public access

VI. Open Questions (To Be Addressed Early)

    Audit thresholds: Should 5 % be adjusted based on user growth?
    Explanation visibility: Should users opt‑in/out of sharing top‑3 explanations publicly?
    Weighting logic: Should country‑level weightings correlate with baseline pollution metrics?

VII. Non‑Negotiables

    No user blocks until demonstrated misuse (flagging triggers investigation, not penalties)
    Data privacy: Countries/wealth fields must never be mandatory
    Leaderboard integrity: Data sorting must never be arbitrary or incentivized unfairly

