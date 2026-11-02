create table public.seasons (
  slug text primary key,
  label text not null,
  sort_order integer not null default 0
);

create table public.collections (
  season_slug text not null references public.seasons(slug) on update cascade on delete cascade,
  slug text not null,
  label text not null,
  start_label text not null,
  end_label text not null,
  sort_order integer not null default 0,
  primary key (season_slug, slug)
);

create table public.tours (
  id text not null check (id ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  season_slug text not null,
  collection_slug text not null,
  title text not null,
  teaser text not null,
  planned_by text,
  meeting_time text not null,
  meeting_place text not null,
  stations text[] not null default '{}',
  highlight boolean not null default false,
  duration_min integer check (duration_min is null or duration_min > 0),
  gpx_key text,
  route_stats jsonb,
  alternative jsonb,
  primary key (season_slug, collection_slug, id),
  foreign key (season_slug, collection_slug)
    references public.collections(season_slug, slug)
    on update cascade on delete cascade
);

create index tours_collection_date_idx
  on public.tours (season_slug, collection_slug, id);

grant select on public.seasons, public.collections, public.tours to anon, authenticated;
grant insert, update, delete on public.seasons, public.collections, public.tours to authenticated;
grant all on public.seasons, public.collections, public.tours to service_role;

alter table public.seasons enable row level security;
alter table public.collections enable row level security;
alter table public.tours enable row level security;

create policy "Public can read seasons"
  on public.seasons for select to anon, authenticated using (true);
create policy "Admins can insert seasons"
  on public.seasons for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can update seasons"
  on public.seasons for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can delete seasons"
  on public.seasons for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Public can read collections"
  on public.collections for select to anon, authenticated using (true);
create policy "Admins can insert collections"
  on public.collections for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can update collections"
  on public.collections for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can delete collections"
  on public.collections for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Public can read tours"
  on public.tours for select to anon, authenticated using (true);
create policy "Admins can insert tours"
  on public.tours for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can update tours"
  on public.tours for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can delete tours"
  on public.tours for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'routes',
  'routes',
  true,
  10485760,
  array['application/gpx+xml', 'application/xml', 'text/xml', 'application/octet-stream']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can read GPX routes"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'routes');
create policy "Admins can upload GPX routes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'routes'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
create policy "Admins can update GPX routes"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'routes'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'routes'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
create policy "Admins can delete GPX routes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'routes'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
