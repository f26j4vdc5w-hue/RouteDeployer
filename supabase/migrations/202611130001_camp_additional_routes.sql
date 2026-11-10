alter table public.tours
  drop constraint tours_additional_routes_check;

update public.tours
set additional_routes = jsonb_build_array(
      jsonb_build_object(
        'gpxKey', alternative ->> 'gpxKey',
        'routeStats', alternative -> 'routeStats',
        'durationMin', coalesce(alternative -> 'durationMin', 'null'::jsonb),
        'stations', alternative -> 'stations'
      )
    ),
    alternative = null
where collection_slug = 'camp'
  and additional_routes = '[]'::jsonb
  and jsonb_typeof(alternative) = 'object'
  and nullif(btrim(alternative ->> 'gpxKey'), '') is not null
  and jsonb_typeof(alternative -> 'routeStats') = 'object'
  and jsonb_typeof(alternative -> 'stations') = 'array'
  and gpx_key is not null
  and route_stats is not null;

alter table public.tours
  add constraint tours_additional_routes_check
    check (
      public.valid_additional_event_routes(additional_routes)
      and (collection_slug in ('events', 'camp') or additional_routes = '[]'::jsonb)
      and (additional_routes = '[]'::jsonb or (gpx_key is not null and route_stats is not null))
    );
