alter table public.apify_connections
  add column auth_method text not null default 'oauth' check (auth_method in ('oauth', 'api_token')),
  add column token_last_four text,
  add column token_label text;
