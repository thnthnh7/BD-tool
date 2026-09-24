alter table public.quotes
  add column if not exists deck_style text not null default 'signal',
  add column if not exists presentation_source text not null default 'generated',
  add column if not exists proposal_pdf_path text,
  add column if not exists proposal_pdf_name text,
  add column if not exists contract_docx_path text,
  add column if not exists contract_docx_name text,
  add column if not exists contract_status text not null default 'draft';

insert into storage.buckets (id, name, public)
values
  ('presentations', 'presentations', false),
  ('contracts', 'contracts', false)
on conflict (id) do nothing;

create policy presentations_member_select on storage.objects
  for select using (
    bucket_id = 'presentations'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy presentations_member_insert on storage.objects
  for insert with check (
    bucket_id = 'presentations'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy presentations_member_update on storage.objects
  for update using (
    bucket_id = 'presentations'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  )
  with check (
    bucket_id = 'presentations'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy presentations_member_delete on storage.objects
  for delete using (
    bucket_id = 'presentations'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy contracts_member_select on storage.objects
  for select using (
    bucket_id = 'contracts'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy contracts_member_insert on storage.objects
  for insert with check (
    bucket_id = 'contracts'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy contracts_member_update on storage.objects
  for update using (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  )
  with check (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy contracts_member_delete on storage.objects
  for delete using (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );
