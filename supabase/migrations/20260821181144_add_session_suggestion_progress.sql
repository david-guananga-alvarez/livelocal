alter table public.session_map_points
  add column progress_status text not null default 'pending',
  add column started_by uuid references auth.users(id) on delete set null,
  add column started_at timestamptz,
  add column completed_at timestamptz;

alter table public.session_map_points
  add constraint session_map_points_progress_status_check
    check (progress_status in ('pending', 'in_progress', 'completed'));

create unique index session_map_points_one_active_per_request_idx
  on public.session_map_points (request_id)
  where progress_status = 'in_progress';

create index session_map_points_started_by_idx
  on public.session_map_points (started_by);

revoke update on table public.session_map_points from authenticated;
grant update (progress_status) on table public.session_map_points to authenticated;

alter policy "clients can delete their map points"
on public.session_map_points
using (
  (
    created_by = (select auth.uid())
    and progress_status = 'pending'
    and exists (
      select 1 from public.requests r
      where r.id = request_id and r.client_id = (select auth.uid())::text
    )
  )
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);

create policy "assigned locals can progress session suggestions"
on public.session_map_points for update to authenticated
using (
  exists (
    select 1 from public.requests r
    where r.id = request_id
      and r.local_id = (select auth.uid())::text
      and r.status = 'in_progress'
  )
)
with check (
  exists (
    select 1 from public.requests r
    where r.id = request_id
      and r.local_id = (select auth.uid())::text
      and r.status = 'in_progress'
  )
);

create or replace function private.enforce_session_suggestion_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not exists (
    select 1 from public.requests r
    where r.id = old.request_id
      and r.local_id = actor::text
      and r.status = 'in_progress'
  ) then
    raise exception 'Only the assigned local can progress this suggestion';
  end if;

  if old.progress_status = 'pending' and new.progress_status = 'in_progress' then
    new.started_by := actor;
    new.started_at := now();
    new.completed_at := null;
    return new;
  end if;

  if old.progress_status = 'in_progress'
    and new.progress_status = 'completed'
    and old.started_by = actor then
    new.started_by := old.started_by;
    new.started_at := old.started_at;
    new.completed_at := now();
    return new;
  end if;

  raise exception 'Invalid session suggestion transition';
end;
$$;

revoke all on function private.enforce_session_suggestion_transition()
  from public, anon, authenticated;

create trigger enforce_session_suggestion_transition
before update on public.session_map_points
for each row execute function private.enforce_session_suggestion_transition();
