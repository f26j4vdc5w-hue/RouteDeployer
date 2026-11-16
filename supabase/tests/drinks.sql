-- Run against an isolated database after applying the drinks migrations.
begin;
insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000004');
insert into public.community_members (user_id, email, display_name, status, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000001', 'treasurer@example.test', 'Kassenwart', 'approved', now()),
  ('00000000-0000-0000-0000-000000000002', 'member@example.test', 'Mitglied', 'approved', now()),
  ('00000000-0000-0000-0000-000000000003', 'pending@example.test', 'Ausstehend', 'pending', now()),
  ('00000000-0000-0000-0000-000000000004', 'multiday@example.test', 'Mehrtägig', 'approved', now())
on conflict (user_id) do update set display_name = excluded.display_name, status = excluded.status,
  email_confirmed_at = excluded.email_confirmed_at;
update public.drinks_settings set opened_at = now() - interval '3 days';
insert into public.drinks_prices (valid_from, cents) values
  ((now() at time zone 'Europe/Berlin')::date - 1, 120),
  ((now() at time zone 'Europe/Berlin')::date, 150);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"app_metadata":{"role":"admin"}}', true);
select public.set_drinks_treasurer('00000000-0000-0000-0000-000000000001', true);
select public.set_drinks_price(200);
select public.set_drinks_payment_hint('Überweisung');
do $$
begin
  begin
    perform public.add_drinks_entry((now() at time zone 'Europe/Berlin')::date + 1, 1);
    raise exception 'future entry accepted';
  exception when raise_exception then
    if sqlerrm = 'future entry accepted' then raise; end if;
  end;
  begin
    perform public.add_drinks_entry((now() at time zone 'Europe/Berlin')::date, 0);
    raise exception 'zero quantity accepted';
  exception when raise_exception then
    if sqlerrm = 'zero quantity accepted' then raise; end if;
  end;
  begin
    perform public.add_drinks_entry((now() at time zone 'Europe/Berlin')::date - 4, 1);
    raise exception 'entry before period accepted';
  exception when raise_exception then
    if sqlerrm = 'entry before period accepted' then raise; end if;
  end;
  begin
    update public.drinks_prices set cents = 1;
    raise exception 'direct price write accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
select public.add_drinks_entry((now() at time zone 'Europe/Berlin')::date - 1, 1);
do $$
declare entry_id bigint;
begin
  select id into entry_id from public.drinks_entries where drink_date = (now() at time zone 'Europe/Berlin')::date - 1;
  assert (select price_cents = 120 from public.drinks_entries where id = entry_id), 'backdated entry used the wrong price';
  perform public.delete_drinks_entry(entry_id);
end $$;
select public.add_drinks_entry((now() at time zone 'Europe/Berlin')::date, 2);

do $$
declare entry_id bigint; rev bigint;
begin
  select id into entry_id from public.drinks_entries where user_id = auth.uid();
  assert (select price_cents = 150 from public.drinks_entries where id = entry_id), 'new price must not apply today';
  perform public.change_drinks_entry(entry_id, 3);
  assert (select quantity = 3 and price_cents = 150 from public.drinks_entries where id = entry_id), 'quantity edit must retain price';
  select revision into rev from public.drinks_settings;
  begin
    perform public.close_drinks_period(rev - 1);
    raise exception 'stale preview accepted';
  exception when raise_exception then
    if sqlerrm = 'stale preview accepted' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{}', true);
select public.add_drinks_entry((now() at time zone 'Europe/Berlin')::date, 1);
do $$
begin
  begin
    perform public.change_drinks_entry((select id from public.drinks_entries where display_name = 'Kassenwart'), 2);
    raise exception 'another member was edited';
  exception when raise_exception then
    if sqlerrm = 'another member was edited' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select public.close_drinks_period((select revision from public.drinks_settings));
do $$
declare entry_id bigint;
begin
  assert (select count(*) = 2 from public.drinks_bills), 'expected one bill per member';
  assert (select total_cents = 450 from public.drinks_bills where user_id = auth.uid()), 'incorrect total';
  assert (select payment_hint = 'Überweisung' from public.drinks_periods order by id desc limit 1), 'missing payment snapshot';
  select id into entry_id from public.drinks_entries where user_id = auth.uid() limit 1;
  begin
    perform public.change_drinks_entry(entry_id, 1);
    raise exception 'closed entry was edited';
  exception when raise_exception then
    if sqlerrm = 'closed entry was edited' then raise; end if;
  end;
end $$;
select public.add_drinks_entry((now() at time zone 'Europe/Berlin')::date, 1);
do $$
begin
  assert (select count(*) = 1 from public.drinks_entries where period_id is null),
    'a new period must accept entries on the same calendar day';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select public.transition_drinks_payment((select id from public.drinks_bills where user_id = auth.uid()), 'report');
select public.transition_drinks_payment((select id from public.drinks_bills where user_id = auth.uid()), 'withdraw');
select public.transition_drinks_payment((select id from public.drinks_bills where user_id = auth.uid()), 'report');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select public.transition_drinks_payment((select id from public.drinks_bills where display_name = 'Mitglied'), 'reject');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select public.transition_drinks_payment((select id from public.drinks_bills where user_id = auth.uid()), 'report');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select public.transition_drinks_payment((select id from public.drinks_bills where display_name = 'Mitglied'), 'confirm');
do $$
begin
  begin
    perform public.transition_drinks_payment((select id from public.drinks_bills where display_name = 'Mitglied'), 'reject');
    raise exception 'confirmed payment was reversed';
  exception when raise_exception then
    if sqlerrm = 'confirmed payment was reversed' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
do $$
begin
  assert (select count(*) = 0 from public.drinks_entries), 'pending member can read entries';
  begin
    perform public.add_drinks_entry((now() at time zone 'Europe/Berlin')::date, 1);
    raise exception 'pending member was allowed to add drinks';
  exception when raise_exception then
    if sqlerrm = 'pending member was allowed to add drinks' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select public.enable_drinks_push('https://fcm.googleapis.com/member-one', 'key', 'auth');
do $$
begin
  begin
    perform public.enable_drinks_push('https://localhost/private', 'key', 'auth');
    raise exception 'unsafe push endpoint accepted';
  exception when raise_exception then
    if sqlerrm = 'unsafe push endpoint accepted' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select public.enable_drinks_push('https://fcm.googleapis.com/member-two', 'key', 'auth');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select public.enable_drinks_push('https://fcm.googleapis.com/member-four', 'key', 'auth');
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into public.seasons (slug, label) values ('drinks-test', 'Test');
insert into public.collections (season_slug, slug, label, color, start_label, end_label)
  values ('drinks-test', 'after-work', 'Test', '#123456', 'Start', 'Ende'),
         ('drinks-test', 'events', 'Test', '#123456', 'Start', 'Ende');
insert into public.tours (season_slug, collection_slug, id, title, teaser, meeting_time, meeting_place, end_date)
  values ('drinks-test', 'after-work', ((now() at time zone 'Europe/Berlin')::date + 1)::text, 'Tour', 'Test', '18:00', 'Test', null),
         ('drinks-test', 'events', ((now() at time zone 'Europe/Berlin')::date)::text || '-abcd', 'Event', 'Test', '18:00', 'Test', (now() at time zone 'Europe/Berlin')::date + 1);
insert into public.community_rsvps (season_slug, collection_slug, user_id, tour_id, display_name, share_personal_data) values
  ('drinks-test', 'after-work', '00000000-0000-0000-0000-000000000001', ((now() at time zone 'Europe/Berlin')::date + 1)::text, 'Kassenwart', false),
  ('drinks-test', 'after-work', '00000000-0000-0000-0000-000000000002', ((now() at time zone 'Europe/Berlin')::date + 1)::text, 'Mitglied', false),
  ('drinks-test', 'events', '00000000-0000-0000-0000-000000000002', ((now() at time zone 'Europe/Berlin')::date)::text || '-abcd', 'Mitglied', true),
  ('drinks-test', 'events', '00000000-0000-0000-0000-000000000004', ((now() at time zone 'Europe/Berlin')::date)::text || '-abcd', 'Mehrtägig', true);
insert into public.drinks_entries (user_id, display_name, drink_date, quantity, price_cents)
  values ('00000000-0000-0000-0000-000000000001', 'Kassenwart', (now() at time zone 'Europe/Berlin')::date + 1, 1, 200);
set local role service_role;
do $$
begin
  assert (select count(*) = 2 from public.claim_drinks_reminders((now() at time zone 'Europe/Berlin')::date + 1)),
    'multi-day participants should be reminded and duplicate RSVPs deduplicated';
  assert (select count(*) = 0 from public.claim_drinks_reminders((now() at time zone 'Europe/Berlin')::date + 1)),
    'reminder claims must not duplicate';
end $$;
reset role;
rollback;
