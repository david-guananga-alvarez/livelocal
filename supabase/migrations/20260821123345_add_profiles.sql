create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'local', 'admin')),
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon;
grant select on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name, avatar_url)
  values (
    new.id,
    'client',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id, role, full_name, avatar_url)
select
  users.id,
  case when locals.user_id is not null then 'local' else 'client' end,
  users.raw_user_meta_data ->> 'full_name',
  users.raw_user_meta_data ->> 'avatar_url'
from auth.users as users
left join public.locals as locals on locals.user_id = users.id
on conflict (id) do update
set
  role = case when excluded.role = 'local' then 'local' else public.profiles.role end,
  full_name = coalesce(public.profiles.full_name, excluded.full_name),
  avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
  updated_at = now();
