create table public.session_map_points (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  instruction text check (char_length(instruction) <= 240),
  created_at timestamptz not null default now()
);

create index session_map_points_request_created_idx
  on public.session_map_points (request_id, created_at);
create index session_map_points_created_by_idx
  on public.session_map_points (created_by);

alter table public.session_map_points enable row level security;

revoke all on table public.session_map_points from public, anon;
grant select, insert, delete on table public.session_map_points to authenticated;

create policy "session participants can read map points"
on public.session_map_points for select to authenticated
using (
  exists (
    select 1 from public.requests r
    where r.id = request_id
      and (r.client_id = (select auth.uid())::text or r.local_id = (select auth.uid())::text)
  )
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);

create policy "active session clients can create map points"
on public.session_map_points for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.requests r
    where r.id = request_id
      and r.client_id = (select auth.uid())::text
      and r.status = 'in_progress'
  )
);

create policy "clients can delete their map points"
on public.session_map_points for delete to authenticated
using (
  (
    created_by = (select auth.uid())
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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'session_map_points'
  ) then
    alter publication supabase_realtime add table public.session_map_points;
  end if;
end $$;
