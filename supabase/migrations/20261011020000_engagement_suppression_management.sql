-- Workspace administrators can maintain the suppression list used by direct sends and sequences.

create policy engagement_suppressions_admin_insert on public.engagement_suppressions
for insert with check (
  workspace_id = public.current_workspace_id()
  and public.current_member_role() in ('owner', 'admin')
);

create policy engagement_suppressions_admin_delete on public.engagement_suppressions
for delete using (
  workspace_id = public.current_workspace_id()
  and public.current_member_role() in ('owner', 'admin')
);
