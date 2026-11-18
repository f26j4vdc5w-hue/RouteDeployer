create function public.reopen_drinks_period(p_period_id bigint, p_revision bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.drinks_settings%rowtype;
  v_period public.drinks_periods%rowtype;
begin
  if not public.is_drinks_treasurer() then
    raise exception 'Kassenwartrechte erforderlich';
  end if;

  select * into v_settings from public.drinks_settings where id for update;
  if p_revision is distinct from v_settings.revision then
    raise exception 'Die Abrechnung ist veraltet; bitte lade sie erneut';
  end if;

  select * into v_period from public.drinks_periods where id = p_period_id for update;
  if not found then
    raise exception 'Abrechnung nicht gefunden';
  end if;
  if p_period_id <> (select max(id) from public.drinks_periods) then
    raise exception 'Nur die neueste Abrechnung kann zurückgenommen werden';
  end if;
  if exists (
    select 1 from public.drinks_bills
    where period_id = p_period_id and payment_status = 'confirmed'
  ) then
    raise exception 'Abrechnung mit bestätigtem Zahlungseingang kann nicht zurückgenommen werden';
  end if;

  update public.drinks_entries set period_id = null where period_id = p_period_id;
  delete from public.drinks_bills where period_id = p_period_id;
  delete from public.drinks_periods where id = p_period_id;
  update public.drinks_settings
    set opened_at = v_period.opened_at, revision = revision + 1
    where id;
end;
$$;

revoke all on function public.reopen_drinks_period(bigint, bigint) from public, anon;
grant execute on function public.reopen_drinks_period(bigint, bigint) to authenticated;

notify pgrst, 'reload schema';
