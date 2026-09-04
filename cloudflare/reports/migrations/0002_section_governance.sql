-- Section reviews are additive. The original governance_signoffs table remains
-- immutable legacy history and is never expanded into section attestations.

CREATE TABLE IF NOT EXISTS governance_observed_section_snapshots (
  report_date TEXT NOT NULL,
  location_id TEXT NOT NULL,
  section_key TEXT NOT NULL CHECK (section_key IN (
    'calendar',
    'notes',
    'potential-fixes',
    'duplicates',
    'anyone-available',
    'staff-first-hour'
  )),
  actor_id TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  entries_json TEXT NOT NULL,
  observed_at_utc TEXT NOT NULL,
  PRIMARY KEY (report_date, location_id, section_key, actor_id)
);

CREATE TABLE IF NOT EXISTS governance_section_signoff_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  report_date TEXT NOT NULL,
  location_id TEXT NOT NULL,
  section_key TEXT NOT NULL CHECK (section_key IN (
    'calendar',
    'notes',
    'potential-fixes',
    'duplicates',
    'anyone-available',
    'staff-first-hour'
  )),
  actor_id TEXT NOT NULL,
  username TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  entries_json TEXT NOT NULL,
  item_count INTEGER NOT NULL CHECK (item_count >= 0),
  signed_at_utc TEXT NOT NULL,
  UNIQUE (actor_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_section_signoffs_latest
  ON governance_section_signoff_events (
    report_date,
    location_id,
    actor_id,
    section_key,
    signed_at_utc DESC,
    id DESC
  );

CREATE INDEX IF NOT EXISTS idx_governance_section_signoffs_audit
  ON governance_section_signoff_events (report_date, signed_at_utc DESC, id DESC);

CREATE TABLE IF NOT EXISTS governance_entry_acknowledgements (
  report_date TEXT NOT NULL,
  location_id TEXT NOT NULL,
  section_key TEXT NOT NULL CHECK (section_key IN (
    'calendar',
    'notes',
    'potential-fixes',
    'duplicates',
    'anyone-available',
    'staff-first-hour'
  )),
  actor_id TEXT NOT NULL,
  entry_key TEXT NOT NULL,
  content_version TEXT NOT NULL,
  observed_snapshot_hash TEXT NOT NULL,
  acknowledged_at_utc TEXT NOT NULL,
  PRIMARY KEY (report_date, location_id, section_key, actor_id, entry_key)
);

CREATE INDEX IF NOT EXISTS idx_governance_acknowledgements_actor_context
  ON governance_entry_acknowledgements (
    report_date,
    location_id,
    actor_id,
    section_key
  );
