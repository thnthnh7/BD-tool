-- Allow platform administrators to add more than the original four plan slots.
alter table public.plans drop constraint if exists plans_slot_check;
alter table public.plans add constraint plans_slot_check check (slot > 0);
