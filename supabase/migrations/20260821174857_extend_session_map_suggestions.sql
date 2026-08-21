alter table public.session_map_points
  add column suggestion_type text not null default 'point',
  add column title text,
  add column route jsonb;

alter table public.session_map_points
  add constraint session_map_points_suggestion_type_check
    check (suggestion_type in ('point', 'place', 'route')),
  add constraint session_map_points_title_length_check
    check (title is null or char_length(title) <= 180),
  add constraint session_map_points_route_shape_check
    check (
      (suggestion_type in ('point', 'place') and route is null)
      or (
        suggestion_type = 'route'
        and jsonb_typeof(route) = 'array'
        and jsonb_array_length(route) between 2 and 50
      )
    );

comment on column public.session_map_points.route is
  'Ordered array of {lat,lng} vertices for a client-suggested route.';
