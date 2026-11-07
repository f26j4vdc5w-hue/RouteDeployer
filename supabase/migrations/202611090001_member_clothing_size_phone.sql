-- Die neuen Angaben bleiben wie die übrigen Profildaten direkt nicht lesbar.
alter table public.community_members
  add column clothing_size text check (clothing_size is null or char_length(clothing_size) <= 40),
  add column phone_number text check (phone_number is null or char_length(phone_number) <= 40);

alter table public.tours
  drop constraint tours_required_personal_fields_check,
  add constraint tours_required_personal_fields_check
    check (
      required_personal_fields <@ array[
        'full_name', 'email', 'address', 'birth_date', 'clothing_size', 'phone_number'
      ]::text[]
      and (collection_slug = 'events' or required_personal_fields = '{}')
    );

-- Die bisherige Signatur bleibt für ältere Clients erhalten und verändert die neuen Felder nicht.
create function public.update_community_member_profile(
  p_display_name text,
  p_full_name text,
  p_address text,
  p_birth_date date,
  p_clothing_size text,
  p_phone_number text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_clothing_size is not null and char_length(btrim(p_clothing_size)) > 40 then
    raise exception 'Die Kleidergröße darf maximal 40 Zeichen lang sein';
  end if;
  if p_phone_number is not null and char_length(btrim(p_phone_number)) > 40 then
    raise exception 'Die Telefonnummer darf maximal 40 Zeichen lang sein';
  end if;

  perform public.update_community_member_profile(p_display_name, p_full_name, p_address, p_birth_date);
  update public.community_members
  set clothing_size = nullif(btrim(p_clothing_size), ''),
      phone_number = nullif(btrim(p_phone_number), '')
  where user_id = (select auth.uid());
end;
$$;

revoke all on function public.update_community_member_profile(text, text, text, date, text, text) from public, anon;
grant execute on function public.update_community_member_profile(text, text, text, date, text, text) to authenticated;

drop function public.get_my_personal_details();
create function public.get_my_personal_details()
returns table (full_name text, address text, birth_date date, clothing_size text, phone_number text)
language sql
stable
security definer
set search_path = ''
as $$
  select members.full_name, members.address, members.birth_date, members.clothing_size, members.phone_number
  from public.community_members as members
  where members.user_id = (select auth.uid());
$$;

revoke all on function public.get_my_personal_details() from public, anon;
grant execute on function public.get_my_personal_details() to authenticated;

create or replace function public.is_plausible_personal_value(p_field text, p_value text)
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
    when 'clothing_size' then
      p_value is not null and char_length(btrim(p_value)) between 1 and 40
    when 'phone_number' then
      p_value is not null
      and char_length(btrim(p_value)) <= 40
      and btrim(p_value) ~ '^[+0-9[:space:]()./-]+$'
      and char_length(regexp_replace(p_value, '[^0-9]', '', 'g')) >= 5
    else false
  end;
$$;

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

  select tours.required_personal_fields into required
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
        when 'clothing_size' then member_row.clothing_size
        when 'phone_number' then member_row.phone_number
      end
    ) then
      raise exception 'Für diese Zusage fehlen plausible Angaben in deinem Profil (%)', field;
    end if;
  end loop;

  return new;
end;
$$;

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
  birth_date date,
  clothing_size text,
  phone_number text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  required text[];
begin
  select tours.required_personal_fields into required
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
    case when 'birth_date' = any (required) then members.birth_date end,
    case when 'clothing_size' = any (required) then members.clothing_size end,
    case when 'phone_number' = any (required) then members.phone_number end
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
