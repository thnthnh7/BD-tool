-- BD Tool SaaS: multi-tenant workspaces, 1 account = 1 role, billing, public shares.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Plans (exactly 4 configurable slots)
-- ---------------------------------------------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slot smallint not null unique check (slot between 1 and 4),
  name text not null,
  slug text not null unique,
  is_public boolean not null default true,
  is_free boolean not null default false,
  price_monthly integer not null default 0 check (price_monthly >= 0),
  price_yearly integer not null default 0 check (price_yearly >= 0),
  trial_days integer not null default 0 check (trial_days >= 0),
  quotas jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  badge text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

insert into public.plans (slot, name, slug, is_public, is_free, price_monthly, price_yearly, trial_days, quotas, features, sort_order, badge)
values
  (
    1, 'Free', 'free', true, true, 0, 0, 0,
    '{"seats":1,"quotes_per_month":5,"ai_briefs_per_month":3}'::jsonb,
    '{"export_docx":true,"share_no_watermark":false,"custom_branding":false,"contracts":true,"google_drive":true}'::jsonb,
    1, ''
  ),
  (
    2, 'Starter', 'starter', true, false, 199000, 1990000, 14,
    '{"seats":1,"quotes_per_month":30,"ai_briefs_per_month":20}'::jsonb,
    '{"export_docx":true,"share_no_watermark":true,"custom_branding":true,"contracts":true,"google_drive":true}'::jsonb,
    2, ''
  ),
  (
    3, 'Pro', 'pro', true, false, 499000, 4990000, 14,
    '{"seats":5,"quotes_per_month":-1,"ai_briefs_per_month":100}'::jsonb,
    '{"export_docx":true,"share_no_watermark":true,"custom_branding":true,"contracts":true,"google_drive":true}'::jsonb,
    3, 'Phổ biến'
  ),
  (
    4, 'Business', 'business', true, false, 1299000, 12990000, 14,
    '{"seats":20,"quotes_per_month":-1,"ai_briefs_per_month":300}'::jsonb,
    '{"export_docx":true,"share_no_watermark":true,"custom_branding":true,"contracts":true,"google_drive":true,"vat_invoice":true}'::jsonb,
    4, ''
  );

-- ---------------------------------------------------------------------------
-- Profiles (email for team UI; synced from auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Workspaces + members (1 user = 1 membership)
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('personal', 'company')),
  name text not null,
  slug text not null unique,
  plan_id uuid not null references public.plans (id),
  plan_status text not null default 'trialing'
    check (plan_status in ('trialing', 'active', 'past_due', 'expired', 'canceled')),
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspaces_plan_id_idx on public.workspaces (plan_id);
create index workspaces_plan_status_idx on public.workspaces (plan_status);

create trigger workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- One account can belong to only one workspace.
create unique index workspace_members_user_id_uidx on public.workspace_members (user_id);
-- Each workspace has exactly one owner.
create unique index workspace_members_one_owner_uidx
  on public.workspace_members (workspace_id)
  where role = 'owner';

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('super_admin', 'support')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

-- These helpers depend on workspace_members and platform_admins, so they must
-- be created after both tables when bootstrapping a fresh database.
create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id
  from public.workspace_members
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_member_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.workspace_members
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

create or replace function public.platform_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.platform_admins where user_id = auth.uid() limit 1;
$$;

create or replace function public.enforce_single_account_role()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'workspace_members' then
    if exists (select 1 from public.platform_admins where user_id = new.user_id) then
      raise exception 'Account already has a platform role';
    end if;
  elsif tg_table_name = 'platform_admins' then
    if exists (select 1 from public.workspace_members where user_id = new.user_id) then
      raise exception 'Account already has a workspace role';
    end if;
  end if;
  return new;
end;
$$;

create trigger workspace_members_single_role
before insert or update on public.workspace_members
for each row execute function public.enforce_single_account_role();

create trigger platform_admins_single_role
before insert or update on public.platform_admins
for each row execute function public.enforce_single_account_role();

-- ---------------------------------------------------------------------------
-- Workspace settings + catalog + quotes
-- ---------------------------------------------------------------------------

create table public.workspace_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  company_name text not null default '',
  short_name text not null default '',
  tax_code text not null default '',
  address text not null default '',
  email text not null default '',
  phone text not null default '',
  website text not null default '',
  logo_path text not null default '/brand/logo.jpg',
  accent_color text not null default '#2FF29E',
  currency text not null default 'VND',
  vat_rate numeric not null default 0,
  quote_validity_days integer not null default 30,
  about text not null default '',
  terms jsonb not null default '[]'::jsonb,
  legal_representative text not null default '',
  legal_representative_title text not null default '',
  bank_account_number text not null default '',
  bank_account_name text not null default '',
  bank_name text not null default '',
  contract_number_prefix text not null default 'HDDV',
  default_warranty_months integer not null default 3,
  default_maintenance_fee integer not null default 0,
  updated_at timestamptz not null default now()
);

create trigger workspace_settings_updated_at
before update on public.workspace_settings
for each row execute function public.set_updated_at();

create table public.module_templates (
  id text primary key,
  name text not null,
  category text not null,
  description text not null default '',
  suggested_price integer not null default 0,
  default_qty integer not null default 1,
  visual_hint text not null default '',
  sort_order integer not null default 0
);

insert into public.module_templates (id, name, category, description, suggested_price, default_qty, visual_hint, sort_order) values
  ('discovery-workshop', 'Discovery & Requirement Workshop', 'Discovery', 'Phân tích nhu cầu, mục tiêu kinh doanh, luồng người dùng và phạm vi MVP trước khi triển khai.', 8000000, 1, 'Workshop, scope map, user flows', 1),
  ('uiux-design', 'UI/UX Design', 'Product', 'Thiết kế wireframe, giao diện chính, design system cơ bản và prototype để review trước khi dev.', 25000000, 1, 'Wireframe, prototype, component library', 2),
  ('landing-page', 'Landing Page / Marketing Website', 'Product', 'Xây dựng landing page hoặc website giới thiệu dịch vụ, responsive và tối ưu tốc độ tải.', 18000000, 1, 'Hero, sections, CTA, responsive', 3),
  ('auth-user', 'User Authentication', 'User', 'Đăng ký, đăng nhập, quên mật khẩu, phân quyền cơ bản và bảo vệ trang riêng tư.', 22000000, 1, 'Login, signup, roles', 4),
  ('profile-management', 'User Profile Management', 'User', 'Cho phép người dùng xem và cập nhật thông tin cá nhân, avatar, mật khẩu và cài đặt tài khoản.', 12000000, 1, 'Profile, settings, account data', 5),
  ('admin-dashboard', 'Admin Dashboard', 'Admin', 'Dashboard quản trị để theo dõi dữ liệu, quản lý người dùng, nội dung và trạng thái hệ thống.', 28000000, 1, 'KPIs, tables, filters, actions', 6),
  ('cms', 'Content Management', 'Admin', 'Quản lý nội dung, banner, bài viết, danh mục hoặc cấu hình hiển thị mà không cần can thiệp code.', 18000000, 1, 'Content list, editor, publishing', 7),
  ('product-catalog', 'Product / Service Catalog', 'Commerce', 'Quản lý danh sách sản phẩm hoặc dịch vụ, danh mục, hình ảnh, trạng thái và thông tin chi tiết.', 24000000, 1, 'Catalog grid, detail page, filters', 8),
  ('cart-checkout', 'Cart & Checkout Flow', 'Commerce', 'Giỏ hàng, quy trình checkout, thông tin giao hàng và xác nhận đơn hàng.', 26000000, 1, 'Cart, checkout steps, order summary', 9),
  ('payment-integration', 'Payment Gateway Integration', 'Commerce', 'Tích hợp cổng thanh toán hoặc chuyển khoản, xử lý trạng thái thanh toán và thông báo kết quả.', 18000000, 1, 'Payment status, webhooks, receipt', 10),
  ('api-integration', 'Third-party API Integration', 'Integration', 'Kết nối hệ thống với API bên thứ ba như CRM, ERP, shipping, payment, email hoặc analytics.', 16000000, 1, 'API flow, sync, mapping', 11),
  ('notification', 'Email / Push Notification', 'Integration', 'Thiết lập email, push notification hoặc thông báo nội bộ theo các sự kiện quan trọng.', 12000000, 1, 'Templates, triggers, delivery', 12),
  ('qa-testing', 'QA Testing & UAT Support', 'Quality', 'Kiểm thử chức năng chính, regression checklist, hỗ trợ UAT và xử lý lỗi trước khi go-live.', 15000000, 1, 'Test plan, bug tracking, UAT', 13),
  ('deployment', 'Deployment & Go-live', 'Quality', 'Cấu hình môi trường production, domain, build pipeline và checklist go-live.', 10000000, 1, 'Production, CI/CD, launch checklist', 14),
  ('maintenance', 'Maintenance & Support', 'Support', 'Gói hỗ trợ sau go-live gồm theo dõi vận hành, xử lý lỗi và cải tiến nhỏ theo tháng.', 12000000, 1, 'Monitoring, support, monthly retainer', 15);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  tax_code text not null default '',
  address text not null default '',
  representative_title text not null default '',
  authorization_doc text not null default '',
  logo_url text not null default '',
  industry text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index clients_workspace_id_idx on public.clients (workspace_id);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  category text not null default 'Product',
  description text not null default '',
  suggested_price integer not null default 0,
  default_qty integer not null default 1,
  visual_hint text not null default 'Custom module',
  created_at timestamptz not null default now()
);

create index modules_workspace_id_idx on public.modules (workspace_id);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  public_id text not null unique,
  client_id uuid references public.clients (id) on delete set null,
  title text not null default '',
  project_type text not null default 'Web App',
  status text not null default 'draft' check (status in ('draft', 'sent', 'won', 'lost')),
  currency text not null default 'VND',
  items jsonb not null default '[]'::jsonb,
  deliverables jsonb not null default '[]'::jsonb,
  discount numeric not null default 0,
  vat_rate numeric not null default 0,
  valid_until date,
  project_overview text not null default '',
  timeline text not null default '',
  next_steps text not null default '',
  contract_number text not null default '',
  payment_milestones jsonb not null default '[]'::jsonb,
  tech_stack jsonb not null default '[]'::jsonb,
  warranty_months integer not null default 3,
  maintenance_fee_monthly integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_workspace_id_idx on public.quotes (workspace_id);
create index quotes_client_id_idx on public.quotes (client_id);

create trigger quotes_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();

create table public.public_quotes (
  id text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index public_quotes_workspace_id_idx on public.public_quotes (workspace_id);

-- ---------------------------------------------------------------------------
-- Invites, usage, billing
-- ---------------------------------------------------------------------------

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token_hash text not null unique,
  invited_by uuid not null references auth.users (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index invites_workspace_id_idx on public.invites (workspace_id);
create index invites_email_idx on public.invites (lower(email));

create table public.usage_counters (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period text not null,
  quotes_created integer not null default 0,
  ai_briefs integer not null default 0,
  primary key (workspace_id, period)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'expired', 'canceled')),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'yearly')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  grace_days integer not null default 7,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  plan_id uuid not null references public.plans (id),
  payment_code text not null unique,
  amount integer not null check (amount >= 0),
  currency text not null default 'VND',
  billing_interval text not null default 'monthly',
  price_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'cancelled')),
  vat_requested boolean not null default false,
  vat_tax_code text not null default '',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index invoices_workspace_id_idx on public.invoices (workspace_id);
create index invoices_status_idx on public.invoices (status);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  sepay_id text not null unique,
  channel text not null check (channel in ('vietqr', 'gateway')),
  amount integer not null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index payments_invoice_id_idx on public.payments (invoice_id);

create table public.platform_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('super_admin', 'support')),
  token_hash text not null unique,
  invited_by uuid not null references auth.users (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.platform_admins enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.module_templates enable row level security;
alter table public.clients enable row level security;
alter table public.modules enable row level security;
alter table public.quotes enable row level security;
alter table public.public_quotes enable row level security;
alter table public.invites enable row level security;
alter table public.usage_counters enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.platform_invites enable row level security;

-- Plans: public catalog readable by anyone; writes only platform super_admin.
create policy plans_select_public on public.plans
  for select using (is_public or auth.uid() is not null);

create policy plans_update_super on public.plans
  for update using (public.platform_role() = 'super_admin')
  with check (public.platform_role() = 'super_admin');

create policy profiles_select_self_or_workspace on public.profiles
  for select using (
    id = auth.uid()
    or public.is_platform_admin()
    or exists (
      select 1
      from public.workspace_members me
      join public.workspace_members them on them.workspace_id = me.workspace_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy workspaces_select on public.workspaces
  for select using (
    id = public.current_workspace_id()
    or public.is_platform_admin()
  );

create policy workspaces_insert_onboard on public.workspaces
  for insert with check (
    auth.uid() is not null
    and not exists (select 1 from public.workspace_members where user_id = auth.uid())
    and not exists (select 1 from public.platform_admins where user_id = auth.uid())
  );

create policy workspaces_update_owner_admin on public.workspaces
  for update using (
    id = public.current_workspace_id()
    and public.current_member_role() in ('owner', 'admin')
  )
  with check (
    id = public.current_workspace_id()
    and public.current_member_role() in ('owner', 'admin')
  );

create policy workspaces_update_platform on public.workspaces
  for update using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy members_select on public.workspace_members
  for select using (
    user_id = auth.uid()
    or workspace_id = public.current_workspace_id()
    or public.is_platform_admin()
  );

create policy members_insert_self_owner on public.workspace_members
  for insert with check (
    user_id = auth.uid()
    and role = 'owner'
    and not exists (select 1 from public.workspace_members where user_id = auth.uid())
    and not exists (select 1 from public.platform_admins where user_id = auth.uid())
  );

create policy members_insert_invite_accept on public.workspace_members
  for insert with check (
    user_id = auth.uid()
    and role in ('admin', 'member')
    and exists (
      select 1
      from public.invites i
      join public.profiles p on p.id = auth.uid()
      where i.workspace_id = workspace_members.workspace_id
        and i.role = workspace_members.role
        and lower(i.email) = lower(p.email)
        and i.accepted_at is null
        and i.expires_at > now()
    )
  );

create policy members_update_owner on public.workspace_members
  for update using (
    workspace_id = public.current_workspace_id()
    and public.current_member_role() = 'owner'
  );

create policy members_delete_owner on public.workspace_members
  for delete using (
    workspace_id = public.current_workspace_id()
    and public.current_member_role() = 'owner'
    and user_id <> auth.uid()
  );

create policy platform_admins_select on public.platform_admins
  for select using (user_id = auth.uid() or public.is_platform_admin());

create policy platform_admins_insert_super on public.platform_admins
  for insert with check (public.platform_role() = 'super_admin');

create policy platform_admins_insert_invite on public.platform_admins
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.platform_invites i
      join public.profiles p on p.id = auth.uid()
      where lower(i.email) = lower(p.email)
        and i.role = platform_admins.role
        and i.accepted_at is null
        and i.expires_at > now()
    )
  );

create policy settings_all_members on public.workspace_settings
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy settings_select_platform on public.workspace_settings
  for select using (public.is_platform_admin());

create policy module_templates_select on public.module_templates
  for select using (true);

create policy clients_member_all on public.clients
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy modules_member_all on public.modules
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy quotes_member_all on public.quotes
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

-- Public slideshow: anyone with the id can read the payload.
create policy public_quotes_select_by_id on public.public_quotes
  for select using (true);

create policy public_quotes_insert_member on public.public_quotes
  for insert with check (workspace_id = public.current_workspace_id());

create policy invites_select on public.invites
  for select using (
    workspace_id = public.current_workspace_id()
    or public.is_platform_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and lower(p.email) = lower(invites.email)
    )
  );

create policy invites_write_admin on public.invites
  for all using (
    workspace_id = public.current_workspace_id()
    and public.current_member_role() in ('owner', 'admin')
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.current_member_role() in ('owner', 'admin')
  );

create policy usage_select on public.usage_counters
  for select using (
    workspace_id = public.current_workspace_id()
    or public.is_platform_admin()
  );

create policy usage_insert_member on public.usage_counters
  for insert with check (workspace_id = public.current_workspace_id());

create policy usage_update_member on public.usage_counters
  for update using (workspace_id = public.current_workspace_id());

create policy subscriptions_select on public.subscriptions
  for select using (
    workspace_id = public.current_workspace_id()
    or public.is_platform_admin()
  );

create policy subscriptions_insert_owner on public.subscriptions
  for insert with check (workspace_id = public.current_workspace_id());

create policy subscriptions_update on public.subscriptions
  for update using (
    (workspace_id = public.current_workspace_id() and public.current_member_role() = 'owner')
    or public.is_platform_admin()
  );

create policy invoices_select on public.invoices
  for select using (
    workspace_id = public.current_workspace_id()
    or public.is_platform_admin()
  );

create policy invoices_insert_owner on public.invoices
  for insert with check (
    workspace_id = public.current_workspace_id()
    and public.current_member_role() = 'owner'
  );

create policy invoices_update_owner_or_platform on public.invoices
  for update using (
    (workspace_id = public.current_workspace_id() and public.current_member_role() = 'owner')
    or public.is_platform_admin()
  );

create policy payments_select on public.payments
  for select using (
    exists (
      select 1 from public.invoices i
      where i.id = payments.invoice_id
        and (i.workspace_id = public.current_workspace_id() or public.is_platform_admin())
    )
  );

create policy platform_invites_super on public.platform_invites
  for all using (public.platform_role() = 'super_admin')
  with check (public.platform_role() = 'super_admin');

create policy platform_invites_select_own on public.platform_invites
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and lower(p.email) = lower(platform_invites.email)
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: workspace logos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy logos_public_read on storage.objects
  for select using (bucket_id = 'logos');

create policy logos_member_insert on storage.objects
  for insert with check (
    bucket_id = 'logos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy logos_member_update on storage.objects
  for update using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  )
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );
