-- Die Getränkekasse verwendet eine gemeinsame Sperre für Buchungen und Abschlüsse.
create table public.drinks_settings (
  id boolean primary key default true check (id),
  opened_at timestamptz not null default now(),
  payment_hint text not null default '',
  revision bigint not null default 0
);
insert into public.drinks_settings (id) values (true);

create table public.drinks_treasurers (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.drinks_prices (
  valid_from date primary key,
  cents integer not null check (cents > 0),
  created_at timestamptz not null default now()
);
insert into public.drinks_prices (valid_from, cents) values ('0001-01-01', 150);

create table public.drinks_periods (
  id bigint generated always as identity primary key,
  opened_at timestamptz not null,
  closed_at timestamptz not null,
  closed_by uuid not null,
  payment_hint text not null
);

create table public.drinks_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  display_name text not null,
  drink_date date not null,
  quantity integer not null check (quantity between 1 and 10000),
  price_cents integer not null check (price_cents > 0),
  created_at timestamptz not null default now(),
  period_id bigint references public.drinks_periods(id) on delete restrict
);
create index drinks_entries_open_idx on public.drinks_entries (user_id, drink_date) where period_id is null;

create table public.drinks_bills (
  id bigint generated always as identity primary key,
  period_id bigint not null references public.drinks_periods(id) on delete restrict,
  user_id uuid not null,
  display_name text not null,
  quantity bigint not null check (quantity > 0),
  total_cents bigint not null check (total_cents > 0),
  payment_status text not null default 'open' check (payment_status in ('open', 'reported', 'confirmed')),
  payment_updated_at timestamptz,
  payment_updated_by uuid,
  unique (period_id, user_id)
);

alter table public.drinks_settings enable row level security;
alter table public.drinks_treasurers enable row level security;
alter table public.drinks_prices enable row level security;
alter table public.drinks_periods enable row level security;
alter table public.drinks_entries enable row level security;
alter table public.drinks_bills enable row level security;

revoke all on public.drinks_settings, public.drinks_treasurers, public.drinks_prices,
  public.drinks_periods, public.drinks_entries, public.drinks_bills from public, anon, authenticated;
grant select on public.drinks_settings, public.drinks_treasurers, public.drinks_prices,
  public.drinks_periods, public.drinks_entries, public.drinks_bills to authenticated;

create policy "Approved members can see drinks settings" on public.drinks_settings
  for select to authenticated using (public.is_approved_member());
create policy "Approved members can see drinks treasurers" on public.drinks_treasurers
  for select to authenticated using (public.is_approved_member());
create policy "Approved members can see drinks prices" on public.drinks_prices
  for select to authenticated using (public.is_approved_member());
create policy "Approved members can see drinks periods" on public.drinks_periods
  for select to authenticated using (public.is_approved_member());
create policy "Approved members can see drinks entries" on public.drinks_entries
  for select to authenticated using (public.is_approved_member());
create policy "Approved members can see drinks bills" on public.drinks_bills
  for select to authenticated using (public.is_approved_member());

create function public.is_drinks_treasurer()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_approved_member() and exists (
    select 1 from public.drinks_treasurers where user_id = auth.uid()
  );
$$;

create function public.set_drinks_treasurer(p_user_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Nur Admins dürfen Kassenwarte verwalten';
  end if;
  if p_enabled then
    if not exists (
      select 1 from public.community_members
      where user_id = p_user_id and status = 'approved' and email_confirmed_at is not null
    ) then
      raise exception 'Nur freigegebene Mitglieder können Kassenwart sein';
    end if;
    insert into public.drinks_treasurers (user_id) values (p_user_id) on conflict do nothing;
  else
    delete from public.drinks_treasurers where user_id = p_user_id;
  end if;
end;
$$;

create function public.add_drinks_entry(p_date date, p_quantity integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_opened timestamptz;
  v_price integer;
  v_name text;
  v_today date := (now() at time zone 'Europe/Berlin')::date;
begin
  if not public.is_approved_member() then raise exception 'Community-Freigabe erforderlich'; end if;
  select opened_at into v_opened from public.drinks_settings where id for update;
  if p_date is null or p_date < (v_opened at time zone 'Europe/Berlin')::date or p_date > v_today then
    raise exception 'Datum liegt außerhalb des offenen Zeitraums';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 10000 then
    raise exception 'Ungültige Anzahl';
  end if;
  select cents into v_price from public.drinks_prices
    where valid_from <= p_date order by valid_from desc limit 1;
  select display_name into v_name from public.community_members where user_id = auth.uid();
  insert into public.drinks_entries (user_id, display_name, drink_date, quantity, price_cents)
    values (auth.uid(), v_name, p_date, p_quantity, v_price);
  update public.drinks_settings set revision = revision + 1 where id;
end;
$$;

create function public.change_drinks_entry(p_id bigint, p_quantity integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_approved_member() then raise exception 'Community-Freigabe erforderlich'; end if;
  perform 1 from public.drinks_settings where id for update;
  if p_quantity is null or p_quantity < 1 or p_quantity > 10000 then raise exception 'Ungültige Anzahl'; end if;
  update public.drinks_entries set quantity = p_quantity
    where id = p_id and user_id = auth.uid() and period_id is null;
  if not found then raise exception 'Eintrag nicht gefunden oder bereits abgerechnet'; end if;
  update public.drinks_settings set revision = revision + 1 where id;
end;
$$;

create function public.delete_drinks_entry(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_approved_member() then raise exception 'Community-Freigabe erforderlich'; end if;
  perform 1 from public.drinks_settings where id for update;
  delete from public.drinks_entries where id = p_id and user_id = auth.uid() and period_id is null;
  if not found then raise exception 'Eintrag nicht gefunden oder bereits abgerechnet'; end if;
  update public.drinks_settings set revision = revision + 1 where id;
end;
$$;

create function public.set_drinks_price(p_cents integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_drinks_treasurer() then raise exception 'Kassenwartrechte erforderlich'; end if;
  if p_cents is null or p_cents < 1 or p_cents > 1000000 then raise exception 'Ungültiger Preis'; end if;
  perform 1 from public.drinks_settings where id for update;
  insert into public.drinks_prices (valid_from, cents)
  values ((clock_timestamp() at time zone 'Europe/Berlin')::date + 1, p_cents)
  on conflict (valid_from) do update set cents = excluded.cents;
  update public.drinks_settings set revision = revision + 1 where id;
end;
$$;

create function public.set_drinks_payment_hint(p_hint text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_drinks_treasurer() then raise exception 'Kassenwartrechte erforderlich'; end if;
  if p_hint is null or length(p_hint) > 2000 then raise exception 'Ungültiger Zahlungshinweis'; end if;
  update public.drinks_settings set payment_hint = p_hint, revision = revision + 1 where id;
end;
$$;

create function public.close_drinks_period(p_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.drinks_settings%rowtype;
  v_period_id bigint;
  v_closed timestamptz;
begin
  if not public.is_drinks_treasurer() then raise exception 'Kassenwartrechte erforderlich'; end if;
  select * into v_settings from public.drinks_settings where id for update;
  if p_revision is distinct from v_settings.revision then
    raise exception 'Die Vorschau ist veraltet; bitte lade die Abrechnung erneut';
  end if;
  if not exists (select 1 from public.drinks_entries where period_id is null) then
    raise exception 'Keine offenen Einträge vorhanden';
  end if;
  v_closed := clock_timestamp();
  insert into public.drinks_periods (opened_at, closed_at, closed_by, payment_hint)
    values (v_settings.opened_at, v_closed, auth.uid(), v_settings.payment_hint)
    returning id into v_period_id;
  update public.drinks_entries set period_id = v_period_id where period_id is null;
  insert into public.drinks_bills (period_id, user_id, display_name, quantity, total_cents)
    select v_period_id, entries.user_id, entries.display_name, sum(entries.quantity), sum(entries.quantity::bigint * entries.price_cents)
    from public.drinks_entries entries
    join (select user_id, max(id) as latest_id from public.drinks_entries where period_id = v_period_id group by user_id) latest on latest.latest_id = entries.id
    group by entries.user_id, entries.display_name;
  update public.drinks_settings set opened_at = v_closed, revision = revision + 1 where id;
  return v_period_id;
end;
$$;

create function public.transition_drinks_payment(p_bill_id bigint, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_bill public.drinks_bills%rowtype;
begin
  if not public.is_approved_member() then raise exception 'Community-Freigabe erforderlich'; end if;
  select * into v_bill from public.drinks_bills where id = p_bill_id for update;
  if not found then raise exception 'Abrechnung nicht gefunden'; end if;
  if p_action = 'report' and v_bill.user_id = auth.uid() and v_bill.payment_status = 'open' then
    update public.drinks_bills set payment_status = 'reported', payment_updated_at = now(), payment_updated_by = auth.uid() where id = p_bill_id;
  elsif p_action = 'withdraw' and v_bill.user_id = auth.uid() and v_bill.payment_status = 'reported' then
    update public.drinks_bills set payment_status = 'open', payment_updated_at = now(), payment_updated_by = auth.uid() where id = p_bill_id;
  elsif p_action = 'reject' and public.is_drinks_treasurer() and v_bill.payment_status = 'reported' then
    update public.drinks_bills set payment_status = 'open', payment_updated_at = now(), payment_updated_by = auth.uid() where id = p_bill_id;
  elsif p_action = 'confirm' and public.is_drinks_treasurer() and v_bill.payment_status = 'reported' then
    update public.drinks_bills set payment_status = 'confirmed', payment_updated_at = now(), payment_updated_by = auth.uid() where id = p_bill_id;
  else
    raise exception 'Zahlungsstatus kann nicht geändert werden';
  end if;
  update public.drinks_settings set revision = revision + 1 where id;
end;
$$;

revoke all on function public.is_drinks_treasurer(), public.set_drinks_treasurer(uuid, boolean),
  public.add_drinks_entry(date, integer), public.change_drinks_entry(bigint, integer),
  public.delete_drinks_entry(bigint), public.set_drinks_price(integer),
  public.set_drinks_payment_hint(text), public.close_drinks_period(bigint),
  public.transition_drinks_payment(bigint, text) from public, anon;
grant execute on function public.is_drinks_treasurer(), public.set_drinks_treasurer(uuid, boolean),
  public.add_drinks_entry(date, integer), public.change_drinks_entry(bigint, integer),
  public.delete_drinks_entry(bigint), public.set_drinks_price(integer),
  public.set_drinks_payment_hint(text), public.close_drinks_period(bigint),
  public.transition_drinks_payment(bigint, text) to authenticated;

notify pgrst, 'reload schema';
