alter table public.contracts
  add column if not exists docx_path text,
  add column if not exists docx_name text;
