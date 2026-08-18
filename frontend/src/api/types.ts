export interface User {
  id: number;
  email: string;
  username: string;
  opt_out_leaderboard: boolean;
  country_iso: string | null;
  country_name: string | null;
  city_name: string | null;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: { id: number; email: string; username: string };
}

export interface Country {
  id: number;
  iso_code: string;
  name: string;
}

export interface Indicator {
  id: number;
  code: string;
  label: string;
  unit: string;
  lower_is_better: boolean;
}

export interface PollutionLog {
  id: number;
  indicator_id: number;
  code: string;
  label: string;
  unit: string;
  log_year: number;
  log_month: number;
  value: number;
  note: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  country_iso: string | null;
  country_name: string | null;
  city_name: string | null;
}
