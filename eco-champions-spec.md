# Ecology Champions — Revised Product Specification

> **Vision**
> The Ecology Champions is a collaborative and gamified platform where users track their sustainability efforts. Top performers in predefined categories (country, location, lifestyle, wealth) must share their strategies (the others should share also), which the community evaluates for authenticity and applicability, fostering transparency, learning, and collective improvement.

---

## 1. Core Concept

Ecology Champions reframes environmental tracking as a **collaborative learning game** rather than a pure competition. Users log their **sustainability efforts** across a basket of indicators (not a single pollution metric). Users are ranked on **category-based leaderboards**, where categories are defined by their context: **country, location, lifestyle, and wealth**.

Fairness and trust are sustained by two complementary mechanisms:

1. **Reciprocal strategy-sharing (the core loop).** The top performers in each category must publicly share the **strategies** behind their results. To keep the system honest and equitable, **everyone — not only the top performers — is expected to share** on a rotating basis. Sharing is the social contract of the platform.
2. **Community evaluation.** Shared strategies are broadcast to the community, which evaluates them along two independent axes:
   - **Authenticity** — does the strategy reflect real, plausibly reproducible behavior?
   - **Applicability** — could other users in similar (or different) contexts realistically adopt it?

The objective is **transparency, learning, and collective improvement**: the platform surfaces what actually works, in context, so that everyone can improve.

### Design Principles
- **Collaborative first, competitive second.** Rankings exist to surface good strategies, not to shame low performers.
- **Effort, not just impact.** Tracking is built around a *basket of sustainability efforts* (actions and indicators), recognizing that absolute pollution numbers disadvantage users in harder contexts.
- **Context is a first-class concept.** Country, location, lifestyle, and wealth are categories that make comparison fair, and they are the lens through which strategies are evaluated for applicability.
- **Reciprocity by default.** Sharing is not a punishment reserved for leaders; it is a rotating expectation of all members.
- **Minimal friction.** Data submission, leaderboard viewing, and strategy sharing require as few steps as possible.

---

## 2. Definitions

- **Sustainability Effort (Log Entry):** A user-submitted record of sustainability behavior for a period. Composed of a **basket of indicators** (e.g., CO₂e in kg, energy use, waste, transport, diet factors) plus optional notes.
- **Strategy:** A structured explanation of *how* a user achieved their results — actions taken, trade-offs, timeline, and what they believe drove the outcome. A strategy is richer than a free-text "explanation": it is evaluated, tagged, and discoverable.
- **Category:** A grouping of users by context for fair comparison: **Country**, **Location** (city/region), **Lifestyle** (e.g., Low/Medium/High consumption footprint band), **Wealth** (e.g., Low/Middle/High income band).
- **Authenticity:** Community-assessed signal that a strategy is genuine and reproducible (not fabricated or plagiarized).
- **Applicability:** Community-assessed signal that a strategy can realistically be adopted by others (in-context and cross-context signals captured separately).
- **Champion:** A top performer in a category who is required to share a strategy.

---

## 3. Incremental Implementation Phases

---

### Phase 1: Foundation & Effort Tracking (2–3 weeks)
**Objective:** Users register, establish their context, and log sustainability efforts as a basket of indicators.

**Features**
- User registration (email/password).
- Profile capturing the four categories:
  - Country (ISO 3166 dropdown).
  - Location (city/region-level gazetteer).
  - Lifestyle band (Low/Medium/High).
  - Wealth band (Low/Middle/High).
- Form to submit **monthly sustainability efforts** as a basket of indicators (e.g., CO₂e kg, energy kWh, waste kg, transport mode, diet factors). Each indicator is optional but the platform computes an aggregate **effort score** when enough indicators are present.
- Simple dashboard to view historical submissions and trend.

**Data Model**
- `User` (id, email, username, country_id, city_id, lifestyle_band, wealth_band)
- `Country` (id, name, iso_code)
- `City` (id, name, country_id, lat, lng)
- `EffortLog` (id, user_id, period_start, period_end, indicators [jsonb], effort_score, notes)

**Deferred**
- No leaderboards, categories, or strategies yet.

---

### Phase 2: Category Leaderboards (1–2 weeks)
**Objective:** Introduce leaderboards ranked within categories (not only globally).

**Features**
- Leaderboards ranked by **highest effort score** (effort is the success metric; lower raw pollution alone does not win).
- Users can view leaderboards scoped to each of the four categories: **by country, by location, by lifestyle, by wealth**, plus a global view. Default view is the user's most specific category.
- Display: username (or anonymized handle), category context, effort score, rank.
- Users can **opt out** of leaderboards (privacy control).

**Data Model Updates**
- Add `opt_out_leaderboard` (boolean) to `User`.
- `LeaderboardSnapshot` (id, category_type, category_value, period, ranked_entries [jsonb]) — materialized for performance.

**Deferred**
- No mandatory strategy sharing yet.

---

### Phase 3: Strategy Sharing & Reciprocity (2 weeks)
**Objective:** Implement the core loop — champions must share strategies, and all members share on a rotating basis.

**Features**
- **Champion obligation.** The **top N** users (configurable, default 3) in each category must publish a **strategy** for their period within **48 hours** of attaining the rank, or be temporarily excluded from that category's leaderboard until they comply.
- **Reciprocal obligation.** **All users** are placed on a **rotating sharing schedule** (default: share at least once per quarter). This embodies "the others should share also" and prevents the platform from becoming a broadcast channel for a small elite. Selection is **stratified random** across categories so each category's shared strategies reflect its membership.
- Strategy authoring UI with structured prompts: *What actions did you take? What trade-offs did you accept? What drove your results? What context matters?*
- Strategies are linked to the `EffortLog` they explain and visible on profiles and leaderboard entries.

**Data Model Updates**
- `Strategy` (id, user_id, effort_log_id, content [jsonb: actions, tradeoffs, drivers, context], created_at, updated_at)
- `SharingObligation` (id, user_id, type [champion|reciprocal], deadline, status, category_type, category_value)
- Add `is_excluded` (boolean) and `excluded_until` (timestamp) to `EffortLog` (per-category exclusion for non-compliance).

**Business Logic**
- Scheduled job (hourly) detects newly-minted champions and creates champion obligations with a 48h deadline; promotes next-ranked user into the excluded champion's slot only while the slot is vacant.

---

### Phase 4: Broadcasting & Community Evaluation (2 weeks)
**Objective:** Share strategies with the community and evaluate them for **authenticity and applicability**.

**Features**
- Strategies from champions and reciprocal sharers are **broadcast** to all participants via:
  - In-app **Strategy Feed** (timeline of recent strategies, filterable by category).
  - Weekly digest email (opt-in).
- Each broadcast strategy carries the author's effort score, rank, and category context.
- **Two-axis community evaluation:**
  - **Authenticity** — members vote *Authentic / Doubtful* and may add evidence (e.g., "this aligns with typical outcomes for this context").
  - **Applicability** — members indicate whether the strategy is adoptable **in their own context** and optionally **across contexts**. This produces both an in-context applicability score and a cross-context transferability signal.
- A strategy's evaluation summary is displayed alongside it (e.g., "87% Authentic · high applicability in Low-Wealth / Urban categories").

**Data Model Updates**
- `Broadcast` (id, strategy_id, broadcast_at, feed_visible)
- `Evaluation` (id, broadcast_id, evaluator_id, authenticity_vote [authentic|doubtful], applicability_in_context [bool], applicability_cross_context [bool], note, created_at)

**Deferred**
- No automated moderation yet; rely on community evaluation + flagging (Phase 5).

---

### Phase 5: Flagging & Moderation (2 weeks)
**Objective:** Handle low-authenticity signals and abusive content through community flagging and moderator review.

**Features**
- "Report" action on every broadcast strategy, with reasons: *Fake data, Plagiarized, Unclear/Vague, Harmful, Outstanding solution*.
- Strategies receiving sustained low-authenticity signals or reports are **temporarily de-emphasized** in the feed pending review.
- Moderators can: **Dismiss** the flag, **Request revision** from the author (with a new deadline), **Hide** the strategy, or **Sanction** the user (warning → temporary suspension for repeat offenses). Sanctions are framed as protecting trust, not as the primary mechanism.
- **SLA:** flags reviewed within 24 hours; escalation to a senior moderator if overdue.
- Outcomes are reported back to the flagger and the author.

**Data Model Updates**
- `Report` (id, broadcast_id, reporter_id, reason, created_at, status)
- `Moderator` (id, user_id, role)
- `ModerationAction` (id, report_id, moderator_id, action, timestamp, note)
- Add `is_flagged`, `feed_visible` to `Broadcast`.

**Business Logic**
- Scheduled job escalates overdue flags.

---

### Phase 6: Weighted Scoring & Context Fairness (2–3 weeks)
**Objective:** Make effort scores comparable across contexts by accounting for contextual difficulty.

**Features**
- Effort scoring weights indicators by **contextual difficulty** derived from the four categories:
  - Country/region baseline (e.g., grid carbon intensity, infrastructure).
  - Location (urban density, transit availability).
  - Lifestyle band.
  - Wealth band (a higher-wealth user reducing by the same absolute amount may not represent the same *effort*).
- Leaderboards show **raw effort** and **weighted effort**; users can toggle. Default view is weighted (fairness); raw remains available for transparency.
- Applicability evaluations feed back into this phase: highly cross-context-applicable strategies are tagged for recommendation.

**Data Model Updates**
- Add `weighted_effort_score` (float) to `EffortLog`.
- `ContextBaseline` (id, category_type, category_value, baseline_value, updated_at) — source of truth for weighting, refreshed periodically.

**Deferred**
- No automated "best strategy for you" recommendation yet (Phase 8).

---

### Phase 7: Privacy, Consent & Compliance (1–2 weeks)
**Objective:** Handle the optional-but-sensitive nature of lifestyle and wealth data responsibly.

**Features**
- Lifestyle and wealth bands are **optional** and **consent-gated**; they unlock finer-grained categories but are never required for participation.
- Users who omit them are ranked in the categories they *do* provide (e.g., country + location).
- Account deletion and full data export (GDPR-aligned).
- Anonymization controls: leaderboard handles can be anonymized by default, with opt-in identity.
- Privacy policy and consent flows for optional fields; clear labeling of which data feeds leaderboards vs. evaluations.

**Deliverables**
- Consent-gated category data.
- Deletion and export flows.
- Documented data-handling policy.

---

### Phase 8: Learning Loop & Recommendations (2–3 weeks)
**Objective:** Convert shared strategies into measurable collective improvement.

**Features**
- **Strategy discovery:** "Strategies that worked for people like you" — recommendations based on the user's categories and on high-applicability evaluations (in-context and cross-context).
- **Outcome tracking:** when a user adopts a strategy, they can mark it and subsequent effort logs are tagged, enabling the platform to measure whether adopted strategies actually improved results.
- **Collective-improvement metrics** surfaced on the dashboard: category-level trend lines, most-adopted strategies, and measured uplift.
- Optional **challenges** ("reduce your effort score by 10% this month") to encourage adoption of shared strategies.

**Data Model Updates**
- `StrategyAdoption` (id, strategy_id, user_id, adopted_at, outcome_effort_log_id)
- `Recommendation` (id, user_id, strategy_id, reason, score, generated_at)

---

### Phase 9: Evaluation & Scaling (Ongoing)
**Objective:** Validate that the platform delivers transparency, learning, and collective improvement, and scale it.

**Quantitative Evaluation**
- Share/compliance rates (% of champions and reciprocal members sharing on time).
- Authenticity distribution of evaluations; flag rates and moderation turnaround.
- Applicability signal quality (do highly-applicable strategies get adopted more?).
- Collective improvement: category-level effort-score trends over time.

**Qualitative Feedback**
- Surveys on perceived fairness of category comparisons.
- Interviews with champions and adopters on whether shared strategies helped.

**Scaling**
- Materialized leaderboard snapshots; read replicas for leaderboard & feed queries.
- Monitoring (latency, error rates); caching for the strategy feed and recommendation scoring.

---

## 4. Key Design Decisions

### From "explain your score" → "share your strategy"
The original spec required top performers to *explain their pollution score*. The vision asks for **strategies** — the how and why behind results — which are richer, structured, and reusable. Strategies are the unit that the community evaluates and that drives learning.

### Reciprocity ("the others should share also")
Mandating only the top 3 creates two failure modes: leaders gaming rank to avoid sharing, and a passive majority that consumes but never contributes. The revised spec introduces a **rotating, stratified reciprocal sharing obligation** so that sharing is the norm for everyone, keeping the strategy feed diverse and equitable across all categories.

### Authenticity **and** applicability
The vision explicitly names two evaluation goals. The original spec had only a "Verify" button (authenticity-adjacent). The revised spec splits evaluation into **Authenticity** (is it real?) and **Applicability** (can others adopt it, in-context and cross-context?), directly serving the "learning" and "collective improvement" goals.

### Four categories as first-class
Country, location, lifestyle, and wealth are promoted from optional weighting fields to **first-class leaderboard categories** and **evaluation lenses**, matching the vision exactly.

### Effort over raw pollution
Ranking by lowest raw pollution punishes users in high-baseline contexts. Ranking by an **effort score** (a weighted basket of sustainability indicators) rewards genuine effort and supports the "collective improvement" goal.

### Anti-cheating retained but rebalanced
The original anti-cheating mechanisms (top-N deadline with temporary exclusion, random audits, flagging, moderation) are preserved, but **reframed**: temporary exclusion and sanctions protect trust rather than being the centerpiece. Reciprocity and two-axis evaluation do most of the trust-building work.

### Privacy for sensitive categories
Because lifestyle and wealth are sensitive, they are optional, consent-gated, and never required for participation; users are ranked in whatever categories they choose to share.

---

## 5. Non-Functional Requirements

- **Performance**
  - Leaderboard views < 500ms (materialized snapshots).
  - Strategy feed and evaluation submission < 300ms.
  - Support 10K concurrent users.
- **Data Retention**
  - User data retained until deletion request (GDPR).
  - Strategies and broadcasts retained for 1 year (moderation/learning history), then archived.
- **Refresh Cadence**
  - Leaderboard snapshots refreshed hourly (or on new submissions).
  - Weighted scoring recomputed daily (or on demand).
  - Champion obligations checked hourly; reciprocal schedule run weekly/monthly.
- **Stack (proposed)**
  - Frontend: React / Next.js
  - Backend: Node.js (Express) or Django
  - Database: PostgreSQL with PostGIS for location; jsonb for indicator/strategy content
  - Hosting: AWS (EC2 + RDS + Lambda for scheduled jobs) or Heroku

---

## 6. Open Questions for Future Iterations

1. How many **top N** champions per category should be obligated to share (default 3)? Should it scale with category size?
2. What **reciprocal sharing cadence** (default quarterly) and **coverage percentage** best balance engagement against burden?
3. Should **applicability** be a single score or kept as separate in-context / cross-context signals?
4. Should **weighted effort** become the default ranking, or remain user-toggleable?
5. How should **strategy adoption and outcome tracking** attribute improvement to a specific strategy vs. other factors?
6. Should a **Hall of Fame** recognize users with consistently high authenticity + applicability and repeated sharing?
7. Should **challenges** be individual, category-wide, or community-wide?
