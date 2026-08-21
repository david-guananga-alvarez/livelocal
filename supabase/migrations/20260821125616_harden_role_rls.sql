create or replace function private.enforce_request_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text;
begin
  select role into actor_role from public.profiles where id = actor;
  if actor_role = 'admin' then return new; end if;

  if new.id <> old.id
    or new.client_id is distinct from old.client_id
    or new.zone is distinct from old.zone
    or new.description is distinct from old.description
    or new.duration_minutes is distinct from old.duration_minutes
    or new.target_latitude is distinct from old.target_latitude
    or new.target_longitude is distinct from old.target_longitude then
    raise exception 'Request fields are immutable after creation';
  end if;

  if actor_role = 'client' and old.client_id = actor::text then
    if new.local_id is distinct from old.local_id
      or not (
        (new.status = 'cancelled' and old.status in ('pending', 'matched', 'on_the_way'))
        or (new.status = 'completed' and old.status = 'in_progress')
      ) then
      raise exception 'Invalid client request transition';
    end if;
    return new;
  end if;

  if actor_role = 'local' then
    if (old.status = 'pending' and old.local_id is null and new.status = 'matched' and new.local_id = actor::text)
      or (old.local_id = actor::text and new.local_id = old.local_id and (
        (old.status = 'matched' and new.status in ('on_the_way', 'cancelled'))
        or (old.status = 'on_the_way' and new.status in ('arrived', 'cancelled'))
        or (old.status = 'arrived' and new.status = 'in_progress')
      )) then
      return new;
    end if;
  end if;

  raise exception 'Request transition is not allowed for this role';
end;
$$;

revoke all on function private.enforce_request_transition() from public, anon, authenticated;
drop trigger if exists enforce_request_transition on public.requests;
create trigger enforce_request_transition
before update on public.requests
for each row execute function private.enforce_request_transition();

grant select, insert, update on table public.requests to authenticated;
grant select, insert on table public.messages to authenticated;
grant select, insert, update on table public.locals to authenticated;

drop policy if exists "Allow public insert requests" on public.requests;
drop policy if exists "Allow public read requests" on public.requests;
drop policy if exists "Allow public update requests" on public.requests;
drop policy if exists "requests_insert_authenticated" on public.requests;
drop policy if exists "requests_select_by_role" on public.requests;
drop policy if exists "requests_update_by_role" on public.requests;

create policy "requests_insert_authenticated"
on public.requests for insert to authenticated
with check (
  client_id = (select auth.uid())::text
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('client', 'admin')
  )
);

create policy "requests_select_by_role"
on public.requests for select to authenticated
using (
  client_id = (select auth.uid())::text
  or local_id = (select auth.uid())::text
  or (
    status = 'pending'
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'local'
    )
  )
  or exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  )
);

create policy "requests_update_by_role"
on public.requests for update to authenticated
using (
  client_id = (select auth.uid())::text
  or local_id = (select auth.uid())::text
  or (
    status = 'pending' and local_id is null
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'local'
    )
  )
  or exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  )
)
with check (
  client_id = (select auth.uid())::text
  or local_id = (select auth.uid())::text
  or exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  )
);

drop policy if exists "Authenticated users can read messages" on public.messages;
drop policy if exists "Authenticated users can insert own messages" on public.messages;
drop policy if exists "messages_select_participants" on public.messages;
drop policy if exists "messages_insert_participants" on public.messages;

create policy "messages_select_participants"
on public.messages for select to authenticated
using (
  exists (
    select 1 from public.requests
    where requests.id = messages.request_id
      and (
        requests.client_id = (select auth.uid())::text
        or requests.local_id = (select auth.uid())::text
      )
  )
  or exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  )
);

create policy "messages_insert_participants"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.requests
    where requests.id = messages.request_id
      and (
        requests.client_id = (select auth.uid())::text
        or requests.local_id = (select auth.uid())::text
      )
  )
);
