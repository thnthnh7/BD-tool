-- Child records must belong to the same workspace as their parent sequence.

delete from public.sequence_steps step
using public.sequences sequence
where step.sequence_id = sequence.id and step.workspace_id is distinct from sequence.workspace_id;

delete from public.sequence_enrollments enrollment
using public.sequences sequence
where enrollment.sequence_id = sequence.id and enrollment.workspace_id is distinct from sequence.workspace_id;

create or replace function public.enforce_sequence_child_workspace()
returns trigger
language plpgsql
set search_path = public
as $$
declare parent_workspace uuid;
begin
  select workspace_id into parent_workspace from public.sequences where id = new.sequence_id;
  if parent_workspace is null or parent_workspace is distinct from new.workspace_id then
    raise exception 'Sequence child workspace does not match its parent';
  end if;
  return new;
end;
$$;

create trigger sequence_steps_parent_workspace_guard
before insert or update of workspace_id, sequence_id on public.sequence_steps
for each row execute function public.enforce_sequence_child_workspace();

create trigger sequence_enrollments_parent_workspace_guard
before insert or update of workspace_id, sequence_id on public.sequence_enrollments
for each row execute function public.enforce_sequence_child_workspace();
