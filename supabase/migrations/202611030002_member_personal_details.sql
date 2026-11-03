-- Optionale persönliche Angaben (vollständiger Name, Adresse, Geburtsdatum).
-- Sie sind ausschließlich für das jeweilige Mitglied selbst lesbar: Die Spalten sind
-- für Clients (auch Admins) nicht direkt selektierbar, Zugriff nur über Funktionen.

alter table public.community_members
  add column full_name text
    check (full_name is null or char_length(full_name) <= 120);

revoke select on public.community_members from authenticated;
grant select (user_id, email, display_name, status, email_confirmed_at, created_at)
  on public.community_members to authenticated;

drop function public.update_community_member_profile(text, text, date);

create function public.update_community_member_profile(
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
end;
$$;

revoke all on function public.update_community_member_profile(text, text, text, date) from public, anon;
grant execute on function public.update_community_member_profile(text, text, text, date) to authenticated;

create function public.get_my_personal_details()
returns table (full_name text, address text, birth_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select members.full_name, members.address, members.birth_date
  from public.community_members as members
  where members.user_id = (select auth.uid());
$$;

revoke all on function public.get_my_personal_details() from public, anon;
grant execute on function public.get_my_personal_details() to authenticated;
