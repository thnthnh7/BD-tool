create table public.actor_input_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_id uuid not null references public.scrape_sources (id) on delete cascade,
  contract_hash text not null,
  input jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

create index actor_input_drafts_lookup_idx
  on public.actor_input_drafts (workspace_id, user_id, expires_at desc);

alter table public.actor_input_drafts enable row level security;

create policy actor_input_drafts_own_select on public.actor_input_drafts
  for select using (
    workspace_id = public.current_workspace_id()
    and user_id = auth.uid()
  );

create policy actor_input_drafts_own_insert on public.actor_input_drafts
  for insert with check (
    workspace_id = public.current_workspace_id()
    and user_id = auth.uid()
  );

create policy actor_input_drafts_own_delete on public.actor_input_drafts
  for delete using (
    workspace_id = public.current_workspace_id()
    and user_id = auth.uid()
  );

grant select, insert, delete on public.actor_input_drafts to authenticated;
grant all on public.actor_input_drafts to service_role;

comment on table public.actor_input_drafts is
  'Short-lived, user-private Actor input drafts prepared by the AI Agent. Creating a draft never starts an Actor run.';
