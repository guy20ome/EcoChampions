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

-- Seed a starter set of countries
INSERT INTO countries (iso_code, name) VALUES
  ('FR', 'France'),
  ('US', 'United States'),
  ('GB', 'United Kingdom'),
  ('DE', 'Germany'),
  ('IN', 'India'),
  ('BR', 'Brazil'),
  ('JP', 'Japan'),
  ('AU', 'Australia'),
  ('CA', 'Canada'),
  ('ES', 'Spain'),
  ('IT', 'Italy'),
  ('MX', 'Mexico'),
  ('ZA', 'South Africa'),
  ('CN', 'China'),
  ('SE', 'Sweden')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Seed starter cities (referenced by country ISO code, resolved at insert time).
-- The NOT EXISTS guard makes this re-runnable against an already-populated cities table.
INSERT INTO cities (country_id, name)
SELECT c.id, v.name
  FROM countries c
  JOIN (
    SELECT 'FR' AS iso, 'Paris' AS name UNION ALL SELECT 'FR', 'Lyon' UNION ALL SELECT 'FR', 'Marseille' UNION ALL SELECT 'FR', 'Toulouse' UNION ALL
    SELECT 'US', 'New York' UNION ALL SELECT 'US', 'Los Angeles' UNION ALL SELECT 'US', 'Chicago' UNION ALL SELECT 'US', 'Seattle' UNION ALL
    SELECT 'GB', 'London' UNION ALL SELECT 'GB', 'Manchester' UNION ALL SELECT 'GB', 'Bristol' UNION ALL
    SELECT 'DE', 'Berlin' UNION ALL SELECT 'DE', 'Munich' UNION ALL SELECT 'DE', 'Hamburg' UNION ALL
    SELECT 'IN', 'Mumbai' UNION ALL SELECT 'IN', 'Delhi' UNION ALL SELECT 'IN', 'Bengaluru' UNION ALL SELECT 'IN', 'Kolkata' UNION ALL
    SELECT 'BR', 'Sao Paulo' UNION ALL SELECT 'BR', 'Rio de Janeiro' UNION ALL SELECT 'BR', 'Brasilia' UNION ALL
    SELECT 'JP', 'Tokyo' UNION ALL SELECT 'JP', 'Osaka' UNION ALL SELECT 'JP', 'Kyoto' UNION ALL
    SELECT 'AU', 'Sydney' UNION ALL SELECT 'AU', 'Melbourne' UNION ALL SELECT 'AU', 'Brisbane' UNION ALL
    SELECT 'CA', 'Toronto' UNION ALL SELECT 'CA', 'Montreal' UNION ALL SELECT 'CA', 'Vancouver' UNION ALL
    SELECT 'ES', 'Madrid' UNION ALL SELECT 'ES', 'Barcelona' UNION ALL SELECT 'ES', 'Seville' UNION ALL
    SELECT 'IT', 'Rome' UNION ALL SELECT 'IT', 'Milan' UNION ALL SELECT 'IT', 'Naples' UNION ALL
    SELECT 'MX', 'Mexico City' UNION ALL SELECT 'MX', 'Guadalajara' UNION ALL SELECT 'MX', 'Monterrey' UNION ALL
    SELECT 'ZA', 'Johannesburg' UNION ALL SELECT 'ZA', 'Cape Town' UNION ALL SELECT 'ZA', 'Durban' UNION ALL
    SELECT 'CN', 'Beijing' UNION ALL SELECT 'CN', 'Shanghai' UNION ALL SELECT 'CN', 'Guangzhou' UNION ALL
    SELECT 'SE', 'Stockholm' UNION ALL SELECT 'SE', 'Gothenburg' UNION ALL SELECT 'SE', 'Malmo'
  ) v ON v.iso = c.iso_code
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE country_id = c.id AND name = v.name);

-- Seed Phase 1 pollution indicators
INSERT INTO pollution_indicators (code, label, unit, lower_is_better) VALUES
  ('co2_monthly', 'Monthly CO2 emissions', 'kg', TRUE),
  ('plastic_monthly', 'Monthly plastic use', 'g', TRUE),
  ('water_monthly', 'Monthly water consumption', 'L', TRUE),
  ('waste_recycled_pct', 'Monthly waste recycled', '%', FALSE)
ON DUPLICATE KEY UPDATE label = VALUES(label), unit = VALUES(unit), lower_is_better = VALUES(lower_is_better);
