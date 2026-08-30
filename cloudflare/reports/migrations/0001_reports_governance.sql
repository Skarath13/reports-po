-- Reports governance data is intentionally separate from report contents and
-- the existing Supabase identity/activity tables.

CREATE TABLE IF NOT EXISTS governance_required_signers (
  actor_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS governance_audit_viewers (
  actor_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS governance_signoffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  location_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  username TEXT NOT NULL,
  signed_at_utc TEXT NOT NULL,
  UNIQUE (report_date, location_id, actor_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_signoffs_date_location
  ON governance_signoffs (report_date, location_id);

CREATE TABLE IF NOT EXISTS governance_login_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL,
  username TEXT NOT NULL,
  role TEXT,
  logged_in_at_utc TEXT NOT NULL,
  event_date_pacific TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_governance_login_events_date
  ON governance_login_events (event_date_pacific, logged_in_at_utc DESC);

CREATE TABLE IF NOT EXISTS governance_report_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  location_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  username TEXT NOT NULL,
  session_id TEXT NOT NULL,
  viewed_at_utc TEXT NOT NULL,
  event_date_pacific TEXT NOT NULL,
  UNIQUE (report_date, location_id, actor_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_report_views_date
  ON governance_report_views (event_date_pacific, viewed_at_utc DESC);

-- Canonical public.users IDs resolved from the live Reports-enabled identity
-- set. These are stable actor IDs; usernames are display snapshots only.
INSERT OR REPLACE INTO governance_required_signers
  (actor_id, display_name, sort_order, active)
VALUES
  ('97b9678a-8f18-484e-98ea-0011eea42c72', 'Ross', 1, 1),
  ('b6d1a09d-9fb2-4aac-bdfa-de75d5272ddf', 'Tonet', 2, 1),
  ('62726a00-21a7-41a1-8f5a-23c3b7203d2d', 'Archie', 3, 1);

INSERT OR REPLACE INTO governance_audit_viewers
  (actor_id, display_name, active)
VALUES
  ('9dee6da3-789a-46de-88f2-128385b2a4c0', 'Katelyn', 1);
