-- Preserve MCP provenance for lists created through AI clients.
alter table public.lead_lists drop constraint if exists lead_lists_source_check;
alter table public.lead_lists
  add constraint lead_lists_source_check
  check (source in ('scrape', 'manual', 'mixed', 'mcp'));
