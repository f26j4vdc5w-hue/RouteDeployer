-- Events: Touren der Kollektion "events", die von bestätigten Mitgliedern angelegt werden.
-- Der Organisator verwaltet sein Event und darf die persönlichen Daten der Teilnehmer
-- einsehen, die beim Beitritt eingewilligt haben.

-- Mehrere Events pro Datum: Die ID darf optional ein Suffix tragen (YYYY-MM-DD-abcd).
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.tours'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%[0-9]{4}-[0-9]{2}-[0-9]{2}%'
  loop
    execute format('alter table public.tours drop constraint %I', constraint_name);
  end loop;
end;
$$;
alter table public.tours
  add constraint tours_id_check
  check (id ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(-[a-z0-9]{4,12})?$');

alter table public.tours
  add column organizer_id uuid references auth.users(id) on delete set null;

create index tours_organizer_idx on public.tours (organizer_id) where organizer_id is not null;

alter table public.community_rsvps
  add column share_personal_data boolean not null default false;

create function public.is_approved_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.community_members as members
    where members.user_id = (select auth.uid())
      and members.status = 'approved'
      and members.email_confirmed_at is not null
  );
$$;

revoke all on function public.is_approved_member() from public;
grant execute on function public.is_approved_member() to authenticated;

-- Organisatoren (keine Admins): Zuordnung und Anzeigename werden serverseitig erzwungen.
create function public.enforce_event_organizer_rules()
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

revoke all on function public.enforce_event_organizer_rules() from public;

create trigger enforce_event_organizer_rules_before_write
  before insert or update on public.tours
  for each row execute function public.enforce_event_organizer_rules();

create policy "Organizers can insert their events"
  on public.tours for insert to authenticated
  with check (
    collection_slug = 'events'
    and organizer_id = (select auth.uid())
    and public.is_approved_member()
  );
create policy "Organizers can update their events"
  on public.tours for update to authenticated
  using (
    collection_slug = 'events'
    and organizer_id = (select auth.uid())
    and public.is_approved_member()
  )
  with check (
    collection_slug = 'events'
    and organizer_id = (select auth.uid())
    and public.is_approved_member()
  );
create policy "Organizers can delete their events"
  on public.tours for delete to authenticated
  using (
    collection_slug = 'events'
    and organizer_id = (select auth.uid())
    and public.is_approved_member()
  );

-- GPX-Dateien von Events liegen unter member-events/<user-id>/.
create policy "Members can upload GPX routes for their events"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'routes'
    and name like 'member-events/' || (select auth.uid())::text || '/%'
    and public.is_approved_member()
  );
create policy "Members can update GPX routes of their events"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'routes'
    and name like 'member-events/' || (select auth.uid())::text || '/%'
  )
  with check (
    bucket_id = 'routes'
    and name like 'member-events/' || (select auth.uid())::text || '/%'
  );
create policy "Members can delete GPX routes of their events"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'routes'
    and name like 'member-events/' || (select auth.uid())::text || '/%'
  );

-- Beitritt zu Events nur mit Einwilligung in die Weitergabe der persönlichen Daten.
create function public.require_event_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.collection_slug = 'events' and not new.share_personal_data then
    raise exception 'Für Events ist die Einwilligung zur Weitergabe der persönlichen Daten erforderlich';
  end if;
  return new;
end;
$$;

revoke all on function public.require_event_consent() from public;

create trigger require_event_consent_before_insert
  before insert on public.community_rsvps
  for each row execute function public.require_event_consent();

-- Persönliche Daten der Teilnehmer, die eingewilligt haben; nur für den Organisator.
create function public.get_event_participant_details(
  p_season_slug text,
  p_collection_slug text,
  p_tour_id text
)
returns table (
  user_id uuid,
  display_name text,
  full_name text,
  address text,
  birth_date date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.tours as tours
    where tours.season_slug = p_season_slug
      and tours.collection_slug = p_collection_slug
      and tours.id = p_tour_id
      and tours.organizer_id = (select auth.uid())
  ) then
    raise exception 'Nur der Organisator darf die Teilnehmerdaten abfragen';
  end if;

  return query
  select members.user_id, members.display_name, members.full_name, members.address, members.birth_date
  from public.community_rsvps as rsvps
  join public.community_members as members on members.user_id = rsvps.user_id
  where rsvps.season_slug = p_season_slug
    and rsvps.collection_slug = p_collection_slug
    and rsvps.tour_id = p_tour_id
    and rsvps.share_personal_data
  order by rsvps.created_at;
end;
$$;

revoke all on function public.get_event_participant_details(text, text, text) from public, anon;
grant execute on function public.get_event_participant_details(text, text, text) to authenticated;

-- Namensänderung: auch den angezeigten Organisator der eigenen Events nachziehen.
create or replace function public.update_community_member_profile(
  p_display_name text,
  p_full_name text,
  p_address text,
  p_birth_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Anmeldung erforderlich';
  end if;
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 60 then
    raise exception 'Der Anzeigename muss zwischen 1 und 60 Zeichen lang sein';
  end if;
  if p_full_name is not null and char_length(btrim(p_full_name)) > 120 then
    raise exception 'Der vollständige Name darf maximal 120 Zeichen lang sein';
  end if;
  if p_address is not null and char_length(btrim(p_address)) > 250 then
    raise exception 'Die Adresse darf maximal 250 Zeichen lang sein';
  end if;
  if p_birth_date is not null and p_birth_date > current_date then
    raise exception 'Das Geburtsdatum darf nicht in der Zukunft liegen';
  end if;

  update public.community_members
  set display_name = btrim(p_display_name),
      full_name = nullif(btrim(p_full_name), ''),
      address = nullif(btrim(p_address), ''),
      birth_date = p_birth_date
  where user_id = current_user_id;

  if not found then
    raise exception 'Das Community-Profil wurde nicht gefunden';
  end if;

  update public.community_rsvps
  set display_name = btrim(p_display_name)
  where user_id = current_user_id
    and display_name is distinct from btrim(p_display_name);

  update public.tours
  set planned_by = btrim(p_display_name)
  where organizer_id = current_user_id
    and planned_by is distinct from btrim(p_display_name);
end;
$$;
