# Revised Project Idea: Durability Tracker with Anti-Cheating

---

## Core Concept

A platform where users track their **environmental impact** (pollution indicators) and compete in **category-based leaderboards**. To ensure fairness and eliminate cheating, **the top 3 users in each category must provide explanations for their scores within 48 hours or be automatically removed from the leaderboard**. Explanations are broadcast to all participants for community evaluation.

To avoid sandbagging, **5% of all users are randomly selected monthly to submit explanations**. **Community Flagging** allows users to report suspicious explanations for moderation or to report efficient solutions.

**Navigation and User Experience:**
The platform prioritizes simplicity, with intuitive and minimal steps required for users to submit data, view leaderboards, and engage with explanations.

---

## Incremental Implementation Phases

---

### Phase 1: Basic Tracking (2-3 weeks)
**Objective:** Users can register and log pollution data.

**Features:**
- User registration (email/password).
- Profile page with country (ISO 3166 dropdown) and location (city-level gazetteer).
- Form to submit **monthly pollution indicators** (e.g., CO₂ emissions in kg).
- Simple dashboard to view historical submissions.

**Data Model:**
- `User` (id, email, username, country_id, city_id)
- `Country` (id, name, iso_code)
- `City` (id, name, country_id, lat, lng)
- `PollutionLog` (id, user_id, date, pollution_value, notes)

**Deferred:**
- No leaderboards, categories, or explanations yet.

---

### Phase 2: Simple Leaderboard (1-2 weeks)
**Objective:** Introduce a global leaderboard.

**Features:**
- Global leaderboard ranked by **lowest pollution value** (ascending).
- Display: username, country, pollution value.
- Users can **opt out** of the leaderboard (privacy control).

**Data Model Updates:**
- Add `opt_out_leaderboard` (boolean) to `User`.

**Deferred:**
- No categories or mandatory explanations yet.

---

### Phase 3: Categories (1-2 weeks)
**Objective:** Group users by context for fairer competition.

**Features:**
- Add **categories** based on country or region (e.g., "Europe", "North America").
- Leaderboards now show **category-specific rankings** (default view).
- Users can switch between global and category views.

**Data Model Updates:**
- Add `Category` (id, name, description).
- Add `category_id` to `User`.

**Deferred:**
- No weighted scoring yet.
- No explanations yet.

---

### Phase 4: Explanation System (2 weeks)
**Objective:** Enable users to explain their scores.

**Features:**
- Add an **optional text field** for users to explain their pollution score.
- Explanations are **visible on user profiles and leaderboard entries** (if provided).
- Users can **edit explanations** at any time.

**Data Model Updates:**
- Add `explanation` (text) and `explanation_updated_at` (timestamp) to `PollutionLog`.

**Deferred:**
- No mandatory explanations yet.
- No broadcasting or moderation yet.

---

### Phase 5: Top 3 Mandatory Explanations (2 weeks)
**Objective:** Enforce anti-cheating rule for top performers.

**Features:**
- **Top 3 users in each category** must submit an explanation within **48 hours** of reaching the top 3.
- If no explanation is provided after 48 hours, the user is **automatically removed** from the leaderboard for that category.
- A **notification system** (email + in-app) alerts top 3 users of the requirement.
- A **countdown timer** is displayed on the user's dashboard if they are in the top 3 without an explanation.

**Data Model Updates:**
- Add `requires_explanation` (boolean) and `explanation_deadline` (timestamp) to `PollutionLog`.
- Add `is_demoted` (boolean) to `User` (for leaderboard exclusion).

**Business Logic:**
- A scheduled job runs hourly to check for overdue explanations and demote users.

---

### Phase 6: Random Audits (1 week)
**Objective:** Prevent sandbagging by randomly auditing users.

**Features:**
- **5% of all users** are randomly selected **monthly** to submit explanations.
- Selected users have **72 hours** to comply.
- Failure to comply results in a **warning** (first offense) or **temporary ban** (repeat offenses).
- Audited users are notified via email + in-app alert.

**Data Model Updates:**
- Add `Audit` (id, user_id, created_at, deadline, status).
- Add `warning_count` (integer) to `User`.

**Business Logic:**
- A cron job runs monthly to select random users and create audit records.

---

### Phase 7: Broadcasting Explanations (1 week)
**Objective:** Share top performers' explanations with the community.

**Features:**
- Explanations from **top 3 users** (and audited users who complied) are **broadcast to all participants** via:
  - In-app feed (like a social media timeline).
  - Weekly digest email (opt-in).
- Explanations include:
  - User's pollution score and rank.
  - Their explanation text.
  - A **"Verify" button** for other users to confirm the explanation seems legitimate.

**Data Model Updates:**
- Add `Broadcast` (id, log_id, broadcast_at).
- Add `Verification` (id, broadcast_id, user_id, is_verified).

**Deferred:**
- No moderation yet (rely on community verification for now).

---

### Phase 8: Community Flagging (1 week)
**Objective:** Allow users to report suspicious explanations or efficient solutions.

**Features:**
- Add a **"Report" button** on all broadcast explanations.
- Users can select a reason (e.g., "Fake data", "Plagiarized", "Unclear", "Efficient solution").
- Flagged explanations are **hidden from the feed** until reviewed.
- Users who flag are notified of the outcome.

**Data Model Updates:**
- Add `Report` (id, broadcast_id, user_id, reason, created_at).
- Add `is_flagged` (boolean) to `Broadcast`.

---

### Phase 9: Moderation System (2 weeks)
**Objective:** Review flagged content and enforce penalties.

**Features:**
- **Admin dashboard** to view flagged explanations.
- Moderators can:
  - **Dismiss** the flag (if unfounded).
  - **Uphold** the flag (explanation remains hidden, user gets a warning).
  - **Ban** the user (temporary or permanent) for repeat offenses.
- **SLA**: Flags must be reviewed within 24 hours.
- **Escalation**: If unresolved after 24 hours, notify a senior moderator.

**Data Model Updates:**
- Add `Moderator` (id, user_id, role).
- Add `ModerationAction` (id, report_id, moderator_id, action, timestamp).

**Business Logic:**
- A scheduled job checks for overdue flags and escalates them.

---

### Phase 10: Weighted Scoring (2-3 weeks)
**Objective:** Introduce fairness by accounting for contextual differences.

**Features:**
- Update scoring algorithm to include **weighting** for:
  - Country/region (e.g., higher weights for high-pollution countries).
  - Lifestyle (optional field: Low/Medium/High).
  - Wealth level (optional field: Low/Medium/High).
- Display both **raw score** and **weighted score** on leaderboards.
- Allow users to **toggle** between raw and weighted rankings.

**Data Model Updates:**
- Add `lifestyle` and `wealth_level` (enums) to `User`.
- Add `weighted_score` (float) to `PollutionLog`.

**Deferred:**
- Wealth/lifestyle are **optional** and do not affect leaderboard eligibility.

---

### Phase 11: Privacy & Compliance (1-2 weeks)
**Objective:** Ensure legal compliance for optional sensitive data.

**Features:**
- Consult legal expert to finalize **GDPR compliance** for lifestyle/wealth data.
- Add **data deletion requests** (users can delete their account and all data).
- Implement **anonymization** for leaderboards (default: show scores without usernames).
- Add a **privacy policy** page and consent flows for optional fields.

**Deliverables:**
- GDPR-compliant data handling.
- User controls for data visibility and deletion.

---

### Phase 12: Evaluation & Scaling (Ongoing)
**Objective:** Validate, iterate, and scale.

**Features:**
- **Quantitative Evaluation**:
  - Analyze leaderboard distribution (are scores discriminative?).
  - Track compliance rates (e.g., % of top 3 providing explanations on time).
  - Measure flagging activity (e.g., % of explanations flagged).
- **Qualitative Feedback**:
  - Survey users on the fairness of the system.
  - Interview top performers on their strategies and experience with explanations.
- **Scaling**:
  - Optimize database queries for leaderboard performance.
  - Deploy monitoring (e.g., Prometheus for latency, Sentry for errors).
  - Plan for horizontal scaling (e.g., read replicas for leaderboard queries).

---

## Non-Functional Requirements
- **Performance**: 
  - Leaderboard updates <500ms.
  - Support 10K concurrent users.
- **Data Retention**: 
  - User data retained until deletion request (GDPR compliance).
  - Explanations and broadcasts retained for 1 year (for moderation history).
- **Refresh Cadence**:
  - Leaderboards update **hourly** (or on new submissions).
  - Scoring recalculated **daily** (or on demand).
- **Stack**:
  - Frontend: React/Next.js
  - Backend: Node.js (Express) or Django
  - Database: PostgreSQL (with PostGIS for location data)
  - Hosting: AWS (EC2 + RDS + Lambda for scheduled jobs) or Heroku

---

## Open Questions for Future Iterations
1. Should the **audit percentage** (5%) or **frequency** (monthly) be adjusted based on user count?
2. Should **repeat offenders** face permanent bans, or is temporary sufficient?
3. Should **weighted scoring** become the default, or remain optional?
4. Should we introduce **a "Hall of Fame"** for users with consistently high rankings and verified explanations?
5. Should we add **a "challenges" system** (e.g., "Reduce your score by 10% this month") to encourage improvement?