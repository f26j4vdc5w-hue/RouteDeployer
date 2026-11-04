-- Der Organisator legt pro Event fest, welche persönlichen Daten für die Teilnahme Pflicht sind.
-- Nur diese Daten sind für ihn sichtbar; eine Zusage ist nur mit plausiblen Angaben möglich.

alter table public.tours
  add column required_personal_fields text[] not null default '{}',
  add constraint tours_required_personal_fields_check
    check (
      required_personal_fields <@ array['full_name', 'email', 'address', 'birth_date']::text[]
      and (collection_slug = 'events' or required_personal_fields = '{}')
    );

-- Bestehende Events: bisherige Datenfreigabe (Name, Adresse, Geburtsdatum) bleibt Pflicht.
update public.tours
set required_personal_fields = array['full_name', 'address', 'birth_date']
where collection_slug = 'events';

create function public.is_plausible_personal_value(p_field text, p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_field
    when 'full_name' then
      p_value is not null
      and btrim(p_value) ~ '^[[:alpha:]][[:alpha:]''.-]*([[:space:]]+[[:alpha:]][[:alpha:]''.-]*)+$'
      and char_length(btrim(p_value)) between 3 and 120
    when 'email' then
      p_value is not null
      and btrim(p_value) ~ '^[^@[:space:]]+@[^@[:space:].]+(\.[^@[:space:].]+)+$'
      and char_length(btrim(p_value)) <= 254
    when 'address' then
      p_value is not null
      and char_length(btrim(p_value)) between 8 and 250
      and btrim(p_value) ~ '[[:alpha:]]'
      and btrim(p_value) ~ '[0-9]'
    else false
  end;
$$;

-- Zusagen zu Events: Einwilligung und plausible Angaben für alle Pflichtfelder.
create or replace function public.require_event_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  required text[];
  member_row public.community_members%rowtype;
  field text;
begin
  if new.collection_slug <> 'events' then
    return new;
  end if;

  if not new.share_personal_data then
    raise exception 'Für Events ist die Einwilligung zur Weitergabe der persönlichen Daten erforderlich';
  end if;

  select tours.required_personal_fields
  into required
  from public.tours as tours
  where tours.season_slug = new.season_slug
    and tours.collection_slug = new.collection_slug
    and tours.id = new.tour_id;

  select * into member_row
  from public.community_members as members
  where members.user_id = new.user_id;

  foreach field in array coalesce(required, '{}') loop
    if field = 'birth_date' then
      if member_row.birth_date is null
         or member_row.birth_date > current_date
         or member_row.birth_date < date '1900-01-01' then
        raise exception 'Für diese Zusage fehlt ein plausibles Geburtsdatum in deinem Profil';
      end if;
    elsif not public.is_plausible_personal_value(
      field,
      case field
        when 'full_name' then member_row.full_name
        when 'email' then member_row.email
        when 'address' then member_row.address
      end
    ) then
      raise exception 'Für diese Zusage fehlen plausible Angaben in deinem Profil (%)', field;
    end if;
  end loop;

  return new;
end;
$$;

-- Nur die Pflichtfelder des Events werden an den Organisator ausgegeben.
drop function public.get_event_participant_details(text, text, text);

create function public.get_event_participant_details(
  p_season_slug text,
  p_collection_slug text,
  p_tour_id text
)
returns table (
  user_id uuid,
  display_name text,
  full_name text,
  email text,
  address text,
  birth_date date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  required text[];
begin
  select tours.required_personal_fields
  into required
  from public.tours as tours
  where tours.season_slug = p_season_slug
    and tours.collection_slug = p_collection_slug
    and tours.id = p_tour_id
    and tours.organizer_id = (select auth.uid());

  if not found then
    raise exception 'Nur der Organisator darf die Teilnehmerdaten abfragen';
  end if;

  return query
  select
    members.user_id,
    members.display_name,
    case when 'full_name' = any (required) then members.full_name end,
    case when 'email' = any (required) then members.email end,
    case when 'address' = any (required) then members.address end,
    case when 'birth_date' = any (required) then members.birth_date end
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
