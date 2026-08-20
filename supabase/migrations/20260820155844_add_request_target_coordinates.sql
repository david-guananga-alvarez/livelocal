alter table public.requests
  add column if not exists target_latitude double precision,
  add column if not exists target_longitude double precision;
