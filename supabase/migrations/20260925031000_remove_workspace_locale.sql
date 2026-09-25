alter table public.workspaces
  drop constraint if exists workspaces_default_locale_check;

alter table public.workspaces
  drop column if exists default_locale;
