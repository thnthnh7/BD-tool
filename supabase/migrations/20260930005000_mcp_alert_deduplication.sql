alter table public.mcp_settings
  add column if not exists last_alert_fingerprint text,
  add column if not exists last_alert_sent_at timestamptz,
  add column if not exists last_alert_resolved_at timestamptz;
