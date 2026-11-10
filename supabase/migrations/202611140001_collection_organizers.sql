create table public.collection_organizers (
  season_slug text not null,
  collection_slug text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (season_slug, collection_slug, user_id),
  foreign key (season_slug, collection_slug)
    references public.collections(season_slug, slug)
    on update cascade on delete cascade
);

alter table public.collection_organizers enable row level security;
revoke all on public.collection_organizers from anon, authenticated;
grant select, insert, delete on public.collection_organizers to authenticated;

create policy "Admins can read collection organizers and organizers can read their assignments"
  on public.collection_organizers for select to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or user_id = (select auth.uid())
  );

create policy "Admins can assign approved collection organizers"
  on public.collection_organizers for insert to authenticated
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and exists (
      select 1
      from public.community_members as members
      where members.user_id = collection_organizers.user_id
        and members.status = 'approved'
        and members.email_confirmed_at is not null
    )
  );

create policy "Admins can remove collection organizers"
  on public.collection_organizers for delete to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create function public.can_manage_collection(
  p_season_slug text,
  p_collection_slug text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    or exists (
      select 1
      from public.collection_organizers as organizers
      join public.community_members as members on members.user_id = organizers.user_id
      where organizers.season_slug = p_season_slug
        and organizers.collection_slug = p_collection_slug
        and organizers.user_id = (select auth.uid())
        and members.status = 'approved'
        and members.email_confirmed_at is not null
    );
$$;

revoke all on function public.can_manage_collection(text, text) from public, anon;
grant execute on function public.can_manage_collection(text, text) to authenticated;

create function public.can_manage_tour_route(p_route_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tours as tours
    where public.can_manage_collection(tours.season_slug, tours.collection_slug)
      and (
        tours.gpx_key = p_route_key
        or tours.alternative ->> 'gpxKey' = p_route_key
        or exists (
          select 1
          from jsonb_array_elements(coalesce(tours.additional_routes, '[]'::jsonb)) as entries(route)
          where route ->> 'gpxKey' = p_route_key
        )
      )
  );
$$;

revoke all on function public.can_manage_tour_route(text) from public, anon;
grant execute on function public.can_manage_tour_route(text) to authenticated;

create policy "Collection organizers can insert tours"
  on public.tours for insert to authenticated
  with check (public.can_manage_collection(season_slug, collection_slug));

create policy "Collection organizers can update tours"
  on public.tours for update to authenticated
  using (public.can_manage_collection(season_slug, collection_slug))
  with check (public.can_manage_collection(season_slug, collection_slug));

create policy "Collection organizers can delete tours"
  on public.tours for delete to authenticated
  using (public.can_manage_collection(season_slug, collection_slug));

create or replace function public.enforce_event_organizer_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_name text;
begin
  if auth.uid() is null
     or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin' then
    return new;
  end if;

  if public.can_manage_collection(new.season_slug, new.collection_slug) then
    if tg_op = 'UPDATE' then
      if new.season_slug is distinct from old.season_slug
         or new.collection_slug is distinct from old.collection_slug
         or new.organizer_id is distinct from old.organizer_id then
        raise exception 'Saison, Kollektion und Organisator einer Tour sind nicht änderbar';
      end if;
    elsif new.collection_slug = 'events' then
      new.organizer_id := null;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.collection_slug <> 'events' or new.organizer_id is distinct from auth.uid() then
      raise exception 'Mitglieder dürfen nur eigene Events anlegen';
    end if;
  elsif new.season_slug is distinct from old.season_slug
     or new.collection_slug is distinct from old.collection_slug
     or new.organizer_id is distinct from old.organizer_id then
    raise exception 'Saison, Kollektion und Organisator eines Events sind nicht änderbar';
  end if;

  select members.display_name
  into member_name
  from public.community_members as members
  where members.user_id = auth.uid();

  new.planned_by := member_name;
  new.highlight := false;
  new.alternative := null;
  return new;
end;
$$;

create policy "Collection organizers can upload collection routes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'routes'
    and array_length(string_to_array(name, '/'), 1) >= 3
    and public.can_manage_collection(
      split_part(name, '/', 1),
      split_part(name, '/', 2)
    )
  );

create policy "Collection organizers can update collection routes"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'routes'
    and array_length(string_to_array(name, '/'), 1) >= 3
    and public.can_manage_collection(
      split_part(name, '/', 1),
      split_part(name, '/', 2)
    )
  )
  with check (
    bucket_id = 'routes'
    and array_length(string_to_array(name, '/'), 1) >= 3
    and public.can_manage_collection(
      split_part(name, '/', 1),
      split_part(name, '/', 2)
    )
  );

create policy "Collection organizers can delete collection routes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'routes'
    and (
      (
        array_length(string_to_array(name, '/'), 1) >= 3
        and public.can_manage_collection(
          split_part(name, '/', 1),
          split_part(name, '/', 2)
        )
      )
      or public.can_manage_tour_route(name)
    )
  );

create or replace function public.get_event_chat_url(
  p_season_slug text,
  p_collection_slug text,
  p_tour_id text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select tours.chat_url
  from public.tours as tours
  where tours.season_slug = p_season_slug
    and tours.collection_slug = p_collection_slug
    and tours.collection_slug = 'events'
    and tours.id = p_tour_id
    and (
      tours.organizer_id = (select auth.uid())
      or public.can_manage_collection(tours.season_slug, tours.collection_slug)
      or exists (
        select 1
        from public.community_rsvps as rsvps
        where rsvps.season_slug = tours.season_slug
          and rsvps.collection_slug = tours.collection_slug
          and rsvps.tour_id = tours.id
          and rsvps.user_id = (select auth.uid())
      )
    );
$$;

notify pgrst, 'reload schema';
