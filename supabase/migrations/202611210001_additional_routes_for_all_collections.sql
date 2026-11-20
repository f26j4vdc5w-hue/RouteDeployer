alter table public.tours
  drop constraint tours_additional_routes_check;

alter table public.tours
  add constraint tours_additional_routes_check
  check (
    public.valid_additional_event_routes(additional_routes)
    and (additional_routes = '[]'::jsonb or (gpx_key is not null and route_stats is not null))
  );
