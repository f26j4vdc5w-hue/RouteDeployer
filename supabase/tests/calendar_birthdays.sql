-- Run against an isolated database after applying all migrations.
begin;
insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000102'),
  ('00000000-0000-0000-0000-000000000103'),
  ('00000000-0000-0000-0000-000000000104'),
  ('00000000-0000-0000-0000-000000000105'),
  ('00000000-0000-0000-0000-000000000106');
insert into public.community_members (user_id, email, display_name, status, email_confirmed_at, birth_date, show_birthday_in_calendar)
values
  ('00000000-0000-0000-0000-000000000101', 'viewer@example.test', 'Betrachter', 'approved', now(), '2000-02-29', true),
  ('00000000-0000-0000-0000-000000000102', 'private@example.test', 'Privat', 'approved', now(), '1990-05-01', false),
  ('00000000-0000-0000-0000-000000000103', 'pending@example.test', 'Ausstehend', 'pending', now(), '1990-05-01', true),
  ('00000000-0000-0000-0000-000000000104', 'unverified@example.test', 'Unbestätigt', 'approved', null, '1990-05-01', true),
  ('00000000-0000-0000-0000-000000000105', 'one@example.test', 'Eins', 'approved', now(), '1990-05-01', true),
  ('00000000-0000-0000-0000-000000000106', 'two@example.test', 'Zwei', 'approved', now(), '1995-05-01', true)
on conflict (user_id) do update set display_name = excluded.display_name, status = excluded.status,
  email_confirmed_at = excluded.email_confirmed_at, birth_date = excluded.birth_date,
  show_birthday_in_calendar = excluded.show_birthday_in_calendar;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
do $$
begin
  assert (select count(*) = 5 from public.get_calendar_birthdays(2027, 2028)), 'only shared approved birthdays should be visible';
  assert (select birthday = date '2028-02-29' and age = 28 from public.get_calendar_birthdays(2027, 2028) where display_name = 'Betrachter'), 'incorrect leap-day birthday or age';
  assert (select count(*) = 2 from public.get_calendar_birthdays(2028, 2028) where birthday = date '2028-05-01'), 'birthdays on the same day must both appear';
  assert (select count(*) = 0 from public.get_calendar_birthdays(1999, 1999) where display_name = 'Betrachter'), 'birthday before birth must not be shown';
  perform public.update_community_member_profile('Betrachter', null, null, null, null, null);
  perform public.update_community_member_profile('Betrachter', null, null, '2000-02-29', null, null);
  assert (select count(*) = 0 from public.get_calendar_birthdays(2028, 2028) where display_name = 'Betrachter'), 'legacy profile update retained sharing after date deletion';
  perform public.update_community_member_profile('Betrachter', null, null, '2000-02-29', null, null, true);
  assert (select count(*) = 1 from public.get_calendar_birthdays(2028, 2028) where display_name = 'Betrachter'), 'opt-in did not enable sharing';
  perform public.update_community_member_profile('Betrachter', null, null, null, null, null, false);
  assert (select count(*) = 0 from public.get_calendar_birthdays(2028, 2028) where display_name = 'Betrachter'), 'revoked birthday still visible';
  begin
    perform public.update_community_member_profile('Betrachter', null, null, null, null, null, true);
    raise exception 'sharing without birth date accepted';
  exception when raise_exception then
    if sqlerrm = 'sharing without birth date accepted' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
do $$
begin
  begin
    perform public.get_calendar_birthdays(2028, 2028);
    raise exception 'pending member could read birthdays';
  exception when raise_exception then
    if sqlerrm = 'pending member could read birthdays' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);
do $$
begin
  begin
    perform public.get_calendar_birthdays(2028, 2028);
    raise exception 'unverified member could read birthdays';
  exception when raise_exception then
    if sqlerrm = 'unverified member could read birthdays' then raise; end if;
  end;
  assert not has_function_privilege('anon', 'public.get_calendar_birthdays(integer,integer)', 'execute'), 'anonymous role can execute birthday function';
end $$;
rollback;
