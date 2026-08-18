-- Ecology Champions - initial schema (Phase 1 MVP)
-- Applied automatically by the MariaDB docker-entrypoint-initdb.d on first start.

CREATE DATABASE IF NOT EXISTS ecology_champions CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ecology_champions;

-- Reference: ISO 3166 countries
CREATE TABLE IF NOT EXISTS countries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  iso_code CHAR(2) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Cities belong to a country
CREATE TABLE IF NOT EXISTS cities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  country_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_city (country_id, name),
  CONSTRAINT fk_cities_country FOREIGN KEY (country_id) REFERENCES countries(id)
) ENGINE=InnoDB;

-- Users (Phase 1: email/password, country, city, leaderboard opt-out)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  country_id INT NULL,
  city_id INT NULL,
  opt_out_leaderboard BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_country FOREIGN KEY (country_id) REFERENCES countries(id),
  CONSTRAINT fk_users_city FOREIGN KEY (city_id) REFERENCES cities(id)
) ENGINE=InnoDB;

-- Refresh tokens issued to users (access tokens are stateless JWTs)
CREATE TABLE IF NOT EXISTS auth_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Pollution indicators (seeded; Phase 1 supports a fixed dropdown)
CREATE TABLE IF NOT EXISTS pollution_indicators (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  lower_is_better BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

-- Monthly pollution logs (one row per user/indicator/year-month)
CREATE TABLE IF NOT EXISTS pollution_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  indicator_id INT NOT NULL,
  log_year SMALLINT NOT NULL,
  log_month TINYINT NOT NULL,
  value DECIMAL(12,3) NOT NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_log (user_id, indicator_id, log_year, log_month),
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_logs_indicator FOREIGN KEY (indicator_id) REFERENCES pollution_indicators(id)
) ENGINE=InnoDB;

-- Pre-materialized per-period rankings (ascending = best first).
-- Lower value ranks higher when lower_is_better; higher value ranks higher otherwise.
CREATE TABLE IF NOT EXISTS rankings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  indicator_id INT NOT NULL,
  log_year SMALLINT NOT NULL,
  log_month TINYINT NOT NULL,
  rank INT NOT NULL,
  value DECIMAL(12,3) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ranking (indicator_id, log_year, log_month, user_id),
  CONSTRAINT fk_rankings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_rankings_indicator FOREIGN KEY (indicator_id) REFERENCES pollution_indicators(id)
) ENGINE=InnoDB;

-- Seed a small starter set of countries
INSERT INTO countries (iso_code, name) VALUES
  ('FR', 'France'),
  ('US', 'United States'),
  ('GB', 'United Kingdom'),
  ('DE', 'Germany'),
  ('IN', 'India')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Seed Phase 1 pollution indicators
INSERT INTO pollution_indicators (code, label, unit, lower_is_better) VALUES
  ('co2_monthly', 'Monthly CO2 emissions', 'kg', TRUE),
  ('plastic_monthly', 'Monthly plastic use', 'g', TRUE),
  ('water_monthly', 'Monthly water consumption', 'L', TRUE),
  ('waste_recycled_pct', 'Monthly waste recycled', '%', FALSE)
ON DUPLICATE KEY UPDATE label = VALUES(label), unit = VALUES(unit), lower_is_better = VALUES(lower_is_better);
