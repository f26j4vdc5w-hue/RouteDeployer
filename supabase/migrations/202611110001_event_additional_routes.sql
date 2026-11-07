create function public.valid_additional_event_routes(p_routes jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_routes) <> 'array' then false else
    not exists (
      select 1 from jsonb_array_elements(p_routes) as entries(route)
      where jsonb_typeof(route) is distinct from 'object'
        or jsonb_typeof(route -> 'gpxKey') is distinct from 'string'
        or length(btrim(route ->> 'gpxKey')) = 0
        or jsonb_typeof(route -> 'routeStats') is distinct from 'object'
        or jsonb_typeof(route -> 'stations') is distinct from 'array'
        or jsonb_path_exists(route, '$.stations[*] ? (@.type() != "string")')
        or jsonb_typeof(route -> 'durationMin') not in ('number', 'null')
        or not (route ? 'durationMin')
        or case when jsonb_typeof(route -> 'durationMin') = 'number' then
          (route ->> 'durationMin')::numeric <= 0
          or (route ->> 'durationMin')::numeric > 2147483647
          or (route ->> 'durationMin')::numeric <> trunc((route ->> 'durationMin')::numeric)
        else false end
    )
  end;
$$;

alter table public.tours
  add column additional_routes jsonb not null default '[]'::jsonb,
  add constraint tours_additional_routes_check
    check (
      public.valid_additional_event_routes(additional_routes)
      and (collection_slug = 'events' or additional_routes = '[]'::jsonb)
      and (additional_routes = '[]'::jsonb or (gpx_key is not null and route_stats is not null))
    );

grant select (additional_routes) on public.tours to anon, authenticated;
