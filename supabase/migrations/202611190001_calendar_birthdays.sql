alter table public.community_members
  add column show_birthday_in_calendar boolean not null default false;

create function public.clear_birthday_sharing_without_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_date is null then
    new.show_birthday_in_calendar := false;
  end if;
  return new;
end;
$$;

revoke all on function public.clear_birthday_sharing_without_date() from public;
create trigger clear_birthday_sharing_without_date
  before update on public.community_members
  for each row execute function public.clear_birthday_sharing_without_date();

drop function public.get_my_personal_details();
create function public.get_my_personal_details()
returns table (full_name text, address text, birth_date date, clothing_size text, phone_number text, show_birthday_in_calendar boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select members.full_name, members.address, members.birth_date, members.clothing_size,
    members.phone_number, members.show_birthday_in_calendar
  from public.community_members as members
  where members.user_id = (select auth.uid());
$$;

revoke all on function public.get_my_personal_details() from public, anon;
grant execute on function public.get_my_personal_details() to authenticated;

create function public.update_community_member_profile(
  p_display_name text, p_full_name text, p_address text, p_birth_date date,
  p_clothing_size text, p_phone_number text, p_show_birthday_in_calendar boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_show_birthday_in_calendar is null then
    raise exception 'Die Geburtstagsfreigabe muss angegeben werden';
  end if;
  if p_show_birthday_in_calendar and p_birth_date is null then
    raise exception 'Für die Geburtstagsfreigabe ist ein Geburtsdatum erforderlich';
  end if;
  perform public.update_community_member_profile(
    p_display_name, p_full_name, p_address, p_birth_date, p_clothing_size, p_phone_number
  );
  update public.community_members
  set show_birthday_in_calendar = p_show_birthday_in_calendar
  where user_id = (select auth.uid());
end;
$$;

revoke all on function public.update_community_member_profile(text, text, text, date, text, text, boolean) from public, anon;
grant execute on function public.update_community_member_profile(text, text, text, date, text, text, boolean) to authenticated;

create function public.get_calendar_birthdays(p_first_year integer, p_last_year integer)
returns table (birthday date, display_name text, age integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.community_members as viewer
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'approved' and viewer.email_confirmed_at is not null
  ) then
    raise exception 'Ein freigegebener Community-Zugang ist erforderlich';
  end if;
  if p_first_year is null or p_last_year is null or p_first_year < 1
    or p_last_year > 9999 or p_first_year > p_last_year or p_last_year - p_first_year > 100 then
    raise exception 'Ungültiger Kalenderzeitraum';
  end if;

  return query
  select candidate.birthday, candidate.display_name, candidate.year - candidate.birth_year
  from (
    select members.display_name, years.year,
      extract(year from members.birth_date)::integer as birth_year,
      extract(month from members.birth_date)::integer as birth_month,
      pg_catalog.make_date(years.year, extract(month from members.birth_date)::integer, 1)
        + (extract(day from members.birth_date)::integer - 1) as birthday
    from public.community_members as members
    cross join pg_catalog.generate_series(p_first_year, p_last_year) as years(year)
    where members.show_birthday_in_calendar and members.birth_date is not null
      and members.status = 'approved' and members.email_confirmed_at is not null
  ) as candidate
  where candidate.year >= candidate.birth_year
    and extract(month from candidate.birthday) = candidate.birth_month
  order by candidate.birthday, candidate.display_name;
end;
$$;

revoke all on function public.get_calendar_birthdays(integer, integer) from public, anon;
grant execute on function public.get_calendar_birthdays(integer, integer) to authenticated;
