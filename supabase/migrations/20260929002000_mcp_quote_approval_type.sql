-- Allow quote lifecycle changes to use the existing owner/admin approval queue.
alter table public.mcp_action_requests drop constraint if exists mcp_action_requests_action_type_check;
alter table public.mcp_action_requests
  add constraint mcp_action_requests_action_type_check
  check (action_type in ('create_company', 'start_maps_scrape', 'mark_quote_sent'));

create or replace function public.notify_mcp_action_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (workspace_id, user_id, title, body, kind, entity_type, entity_id)
    select
      new.workspace_id,
      member.user_id,
      'MCP approval required',
      case new.action_type
        when 'start_maps_scrape' then 'An AI client requested a paid scrape run.'
        when 'mark_quote_sent' then 'An AI client requested that a draft quote be marked as sent.'
        else 'An AI client requested an action that needs approval.'
      end,
      'warning',
      'mcp_action_request',
      new.id::text
    from public.workspace_members member
    where member.workspace_id = new.workspace_id
      and member.role in ('owner', 'admin');
  end if;
  return new;
end;
$$;
