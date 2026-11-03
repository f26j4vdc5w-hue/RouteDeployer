alter table public.community_members
  add column address text
    check (address is null or char_length(address) <= 250),
  add column birth_date date;

create function public.update_community_member_profile(
  p_display_name text,
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
  if p_address is not null and char_length(p_address) > 250 then
    raise exception 'Die Adresse darf maximal 250 Zeichen lang sein';
  end if;
  if p_birth_date is not null and p_birth_date > current_date then
    raise exception 'Das Geburtsdatum darf nicht in der Zukunft liegen';
  end if;

  update public.community_members
  set display_name = btrim(p_display_name),
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

revoke all on function public.update_community_member_profile(text, text, date) from public, anon;
grant execute on function public.update_community_member_profile(text, text, date) to authenticated;
