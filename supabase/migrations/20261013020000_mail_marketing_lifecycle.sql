-- Product lifecycle email, isolated from workspace sales sequences.

create table public.mail_marketing_settings (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default false,
  sender_name text not null default 'Bizcraw',
  sender_email text not null default 'updates@bizcraw.com',
  reply_to text not null default '',
  daily_marketing_limit integer not null default 1 check (daily_marketing_limit between 1 and 10),
  weekly_marketing_limit integer not null default 3 check (weekly_marketing_limit between 1 and 30),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.mail_marketing_settings (id) values (1) on conflict (id) do nothing;

create table public.mail_marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  trigger_key text not null check (trigger_key in ('beta_welcome', 'beta_no_source', 'beta_no_scrape', 'beta_first_value', 'beta_inactive', 'beta_expiry_14', 'beta_expiry_2')),
  category text not null check (category in ('service', 'product_tips', 'beta_updates', 'announcements')),
  delay_hours integer not null default 0 check (delay_hours between 0 and 8760),
  subject_template text not null,
  body_template text not null,
  cta_label text not null default 'Open Bizcraw',
  cta_path text not null default '/app' check (cta_path like '/%' and cta_path not like '//%'),
  send_once boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger mail_marketing_campaigns_updated_at before update on public.mail_marketing_campaigns
for each row execute function public.set_updated_at();
create trigger mail_marketing_settings_updated_at before update on public.mail_marketing_settings
for each row execute function public.set_updated_at();

create table public.email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  product_tips boolean not null default false,
  beta_updates boolean not null default false,
  announcements boolean not null default false,
  unsubscribed_all boolean not null default false,
  consent_source text not null default 'none',
  consent_at timestamptz,
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger email_preferences_updated_at before update on public.email_preferences
for each row execute function public.set_updated_at();

create table public.user_product_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_path text not null default '/app',
  session_count integer not null default 1,
  primary key (user_id, workspace_id)
);

create index user_product_activity_workspace_idx on public.user_product_activity(workspace_id, last_seen_at desc);

create table public.mail_marketing_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.mail_marketing_campaigns(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  beta_enrollment_id uuid references public.beta_campaign_enrollments(id) on delete set null,
  to_email text not null,
  to_name text not null default '',
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'canceled')),
  dedupe_key text not null unique,
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  provider_message_id text,
  subject_rendered text,
  variables jsonb not null default '{}'::jsonb,
  last_error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  clicked_at timestamptz,
  returned_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mail_marketing_deliveries_queue_idx on public.mail_marketing_deliveries(status, available_at)
where status in ('queued', 'failed');
create index mail_marketing_deliveries_user_idx on public.mail_marketing_deliveries(user_id, created_at desc);
create index mail_marketing_deliveries_provider_idx on public.mail_marketing_deliveries(provider_message_id)
where provider_message_id is not null;
create trigger mail_marketing_deliveries_updated_at before update on public.mail_marketing_deliveries
for each row execute function public.set_updated_at();

create table public.mail_marketing_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'resend',
  provider_event_id text not null,
  event_type text not null,
  provider_message_id text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table public.mail_marketing_suppressions (
  email text primary key,
  reason text not null check (reason in ('unsubscribe', 'bounce', 'complaint', 'manual')),
  user_id uuid references auth.users(id) on delete set null,
  source text not null default 'system',
  created_at timestamptz not null default now()
);

alter table public.mail_marketing_settings enable row level security;
alter table public.mail_marketing_campaigns enable row level security;
alter table public.email_preferences enable row level security;
alter table public.user_product_activity enable row level security;
alter table public.mail_marketing_deliveries enable row level security;
alter table public.mail_marketing_provider_events enable row level security;
alter table public.mail_marketing_suppressions enable row level security;

create policy mail_marketing_settings_admin on public.mail_marketing_settings
for all to authenticated using (public.platform_role() = 'super_admin') with check (public.platform_role() = 'super_admin');
create policy mail_marketing_campaigns_admin on public.mail_marketing_campaigns
for all to authenticated using (public.platform_role() = 'super_admin') with check (public.platform_role() = 'super_admin');
create policy mail_marketing_deliveries_admin_read on public.mail_marketing_deliveries
for select to authenticated using (public.platform_role() = 'super_admin');
create policy mail_marketing_events_admin_read on public.mail_marketing_provider_events
for select to authenticated using (public.platform_role() = 'super_admin');
create policy mail_marketing_suppressions_admin on public.mail_marketing_suppressions
for all to authenticated using (public.platform_role() = 'super_admin') with check (public.platform_role() = 'super_admin');
create policy email_preferences_self_read on public.email_preferences
for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
create policy email_preferences_self_update on public.email_preferences
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy email_preferences_self_insert on public.email_preferences
for insert to authenticated with check (user_id = auth.uid());
create policy product_activity_self_read on public.user_product_activity
for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());

create or replace function public.initialize_email_preferences()
returns trigger language plpgsql security definer set search_path = public as $$
declare opted_in boolean := coalesce(new.raw_user_meta_data ->> 'marketing_consent', 'false') = 'true';
begin
  insert into public.email_preferences (user_id, product_tips, beta_updates, announcements, consent_source, consent_at)
  values (new.id, opted_in, opted_in, false, case when opted_in then 'signup' else 'none' end, case when opted_in then now() else null end)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_initialize_email_preferences on auth.users;
create trigger on_auth_user_initialize_email_preferences after insert on auth.users
for each row execute function public.initialize_email_preferences();

insert into public.email_preferences (user_id)
select id from auth.users on conflict (user_id) do nothing;

create or replace function public.record_product_activity(p_workspace_id uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare previous_seen timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists (select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = auth.uid()) then
    raise exception 'forbidden';
  end if;
  select last_seen_at into previous_seen from public.user_product_activity
  where user_id = auth.uid() and workspace_id = p_workspace_id;
  insert into public.user_product_activity (user_id, workspace_id, last_path)
  values (auth.uid(), p_workspace_id, left(coalesce(nullif(p_path, ''), '/app'), 240))
  on conflict (user_id, workspace_id) do update set
    last_seen_at = now(),
    last_path = excluded.last_path,
    session_count = user_product_activity.session_count + case when previous_seen is null or previous_seen < now() - interval '30 minutes' then 1 else 0 end;
  update public.mail_marketing_deliveries
  set returned_at = now()
  where user_id = auth.uid() and workspace_id = p_workspace_id and clicked_at is not null and returned_at is null;
end;
$$;

revoke all on function public.record_product_activity(uuid, text) from public, anon;
grant execute on function public.record_product_activity(uuid, text) to authenticated;

create or replace function public.claim_mail_marketing_deliveries(p_limit integer default 20)
returns setof public.mail_marketing_deliveries
language plpgsql security definer set search_path = public as $$
begin
  if (auth.jwt() ->> 'role') <> 'service_role' then raise exception 'service_role_required'; end if;
  return query
  update public.mail_marketing_deliveries d set status = 'sending', attempt_count = d.attempt_count + 1
  where d.id in (
    select q.id from public.mail_marketing_deliveries q
    where q.status in ('queued', 'failed') and q.available_at <= now() and q.attempt_count < q.max_attempts
    order by q.available_at, q.created_at for update skip locked limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) returning d.*;
end;
$$;

revoke all on function public.claim_mail_marketing_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_mail_marketing_deliveries(integer) to service_role;

insert into public.mail_marketing_campaigns
  (slug, name, status, trigger_key, category, delay_hours, subject_template, body_template, cta_label, cta_path, sort_order)
values
  ('beta-welcome', 'Beta welcome', 'active', 'beta_welcome', 'service', 0,
   'Welcome to Bizcraw Beta — you are member #{{position}}',
   'Hi {{first_name}},\n\nYour Bizcraw Beta workspace is ready. You are member #{{position}} of {{capacity}} and have full access until {{access_ends}}.\n\nStart with one useful result: choose a source that matches the data you need.',
   'Choose your first source', '/app/leads/sources', 10),
  ('beta-no-source', 'No source installed', 'active', 'beta_no_source', 'product_tips', 24,
   'Your first Bizcraw result is about 2 minutes away',
   'Hi {{first_name}},\n\nYour workspace is ready, but you have not selected a data source yet. Choose what you want to find and Bizcraw will guide you through the required inputs.',
   'Choose a source', '/app/leads/sources', 20),
  ('beta-no-scrape', 'Source installed, no scrape', 'active', 'beta_no_scrape', 'product_tips', 48,
   'Ready to collect your first results?',
   'Hi {{first_name}},\n\nYou have installed a source. The next step is to provide its search inputs and run it. Your Apify usage remains under your control.',
   'Run your first scrape', '/app/leads/scrape/new', 30),
  ('beta-first-value', 'First scrape succeeded', 'active', 'beta_first_value', 'product_tips', 0,
   'Your first Bizcraw dataset is ready',
   'Hi {{first_name}},\n\nYour first scrape succeeded. Review the records, remove anything you do not need and promote the useful results into your CRM workflow.',
   'Review results', '/app/leads/scrape', 40),
  ('beta-inactive', 'Beta inactive for 7 days', 'active', 'beta_inactive', 'product_tips', 168,
   'Continue where you left off in Bizcraw',
   'Hi {{first_name}},\n\nYour Beta access is still active. Continue from the last step in your workspace and get one useful dataset into your sales workflow.',
   'Return to Bizcraw', '/app', 50),
  ('beta-expiry-14', 'Beta expires in 14 days', 'active', 'beta_expiry_14', 'service', 0,
   '{{days_left}} days remain in your Bizcraw Beta access',
   'Hi {{first_name}},\n\nYour Beta access ends on {{access_ends}}. Your workspace data stays associated with your account. Review your usage and choose the plan that fits before access changes.',
   'Review your plan', '/app/billing', 60),
  ('beta-expiry-2', 'Beta expires in 2 days', 'active', 'beta_expiry_2', 'service', 0,
   'Your Bizcraw Beta access ends in {{days_left}} days',
   'Hi {{first_name}},\n\nYour full Beta access ends on {{access_ends}}. Choose a plan to keep the corresponding modules active after the promotional period.',
   'Choose a plan', '/app/billing', 70)
on conflict (slug) do nothing;
