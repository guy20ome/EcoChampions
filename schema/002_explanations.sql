-- Phase 2: Event Explanations & Discussion Wall
-- Run after 001_init.sql

USE ecology_champions;

-- Event types that trigger explanations
CREATE TABLE IF NOT EXISTS explanation_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Seed event types
INSERT INTO explanation_events (code, label, description) VALUES
  ('first_report', 'First Monthly Report', 'User submitted their first monthly pollution report'),
  ('significant_increase', 'Significant Increase', 'Indicator increased significantly vs previous month'),
  ('significant_decrease', 'Significant Decrease', 'Indicator decreased significantly vs previous month'),
  ('combined_improvement', 'Combined Score Improvement', 'Overall combined score improved significantly'),
  ('combined_decline', 'Combined Score Decline', 'Overall combined score declined significantly')
ON DUPLICATE KEY UPDATE label = VALUES(label), description = VALUES(description);

-- Event explanations posted by users
CREATE TABLE IF NOT EXISTS event_explanations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  event_type_id INT NOT NULL,
  indicator_id INT NULL,  -- NULL for combined events, specific indicator for indicator events
  log_year SMALLINT NOT NULL,
  log_month TINYINT NOT NULL,
  content TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_explanations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_explanations_event FOREIGN KEY (event_type_id) REFERENCES explanation_events(id),
  CONSTRAINT fk_explanations_indicator FOREIGN KEY (indicator_id) REFERENCES pollution_indicators(id),
  -- Prevent duplicate explanations for same user/event/indicator/period
  CONSTRAINT uq_explanation_user_event_period UNIQUE (user_id, event_type_id, indicator_id, log_year, log_month)
) ENGINE=InnoDB;

-- Comments/discussions on explanations
CREATE TABLE IF NOT EXISTS explanation_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  explanation_id INT NOT NULL,
  user_id INT NOT NULL,
  parent_comment_id INT NULL,  -- For threaded replies
  content TEXT NOT NULL,
  is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_explanation FOREIGN KEY (explanation_id) REFERENCES event_explanations(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_comment_id) REFERENCES explanation_comments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Indexes for performance
CREATE INDEX idx_explanations_user_period ON event_explanations(user_id, log_year, log_month);
CREATE INDEX idx_explanations_published ON event_explanations(is_published, created_at DESC);
CREATE INDEX idx_comments_explanation ON explanation_comments(explanation_id, created_at);
CREATE INDEX idx_comments_user ON explanation_comments(user_id);

-- View for dashboard wall: latest published explanations with author info and comment count
CREATE OR REPLACE VIEW dashboard_wall AS
SELECT
  e.id AS explanation_id,
  e.user_id,
  u.username,
  u.country_iso,
  u.city_name,
  e.event_type_id,
  ev.code AS event_code,
  ev.label AS event_label,
  e.indicator_id,
  pi.code AS indicator_code,
  pi.label AS indicator_label,
  pi.unit AS indicator_unit,
  e.log_year,
  e.log_month,
  e.content,
  e.created_at,
  COUNT(c.id) AS comment_count
FROM event_explanations e
JOIN users u ON u.id = e.user_id
JOIN explanation_events ev ON ev.id = e.event_type_id
LEFT JOIN pollution_indicators pi ON pi.id = e.indicator_id
LEFT JOIN explanation_comments c ON c.explanation_id = e.id AND c.parent_comment_id IS NULL
WHERE e.is_published = TRUE
GROUP BY e.id
ORDER BY e.created_at DESC;