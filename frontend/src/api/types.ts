export interface User {
  id: number;
  email: string;
  username: string;
  opt_out_leaderboard: boolean;
  country_id: number | null;
  country_iso: string | null;
  country_name: string | null;
  city_id: number | null;
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

export interface CombinedLeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  country_iso: string | null;
  country_name: string | null;
  city_name: string | null;
  combined_score: number;
}

export interface ExplanationEvent {
  id: number;
  code: string;
  label: string;
  description: string | null;
}

export interface EventExplanation {
  explanation_id: number;
  user_id: number;
  username: string;
  country_iso: string | null;
  city_name: string | null;
  event_code: string;
  event_label: string;
  indicator_id: number | null;
  indicator_code: string | null;
  indicator_label: string | null;
  indicator_unit: string | null;
  log_year: number;
  log_month: number;
  content: string;
  created_at: string;
  comment_count: number;
}

export interface ExplanationComment {
  id: number;
  explanation_id: number;
  user_id: number;
  username: string;
  parent_comment_id: number | null;
  content: string;
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
  replies: ExplanationComment[];
}

export interface PendingExplanation {
  pending: boolean;
  year: number;
  month: number;
  has_logs: boolean;
  has_explanation: boolean;
}
