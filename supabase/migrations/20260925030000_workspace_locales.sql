alter table public.profiles
  add column if not exists preferred_locale text;

alter table public.profiles
  drop constraint if exists profiles_preferred_locale_check;
alter table public.profiles
  add constraint profiles_preferred_locale_check check (
    preferred_locale is null or preferred_locale in (
      'en', 'vi', 'zh-CN', 'zh-TW', 'es', 'pt-BR', 'fr', 'de', 'it', 'nl',
      'pl', 'tr', 'ru', 'uk', 'ja', 'ko', 'id', 'th', 'ar', 'hi'
    )
  );

alter table public.workspaces
  add column if not exists default_locale text not null default 'en';

update public.workspaces set default_locale = 'vi';

alter table public.workspaces
  drop constraint if exists workspaces_default_locale_check;
alter table public.workspaces
  add constraint workspaces_default_locale_check check (
    default_locale in (
      'en', 'vi', 'zh-CN', 'zh-TW', 'es', 'pt-BR', 'fr', 'de', 'it', 'nl',
      'pl', 'tr', 'ru', 'uk', 'ja', 'ko', 'id', 'th', 'ar', 'hi'
    )
  );
