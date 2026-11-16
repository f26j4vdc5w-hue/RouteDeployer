create table public.drinks_push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.drinks_push_subscriptions enable row level security;
revoke all on public.drinks_push_subscriptions from public, anon, authenticated;
grant select, delete on public.drinks_push_subscriptions to authenticated;
grant delete on public.drinks_push_subscriptions to service_role;
create policy "Members can read their own drinks subscriptions"
  on public.drinks_push_subscriptions for select to authenticated
  using (user_id = auth.uid() and public.is_approved_member());
create policy "Members can remove their own drinks subscriptions"
  on public.drinks_push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

create function public.enable_drinks_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_approved_member() then raise exception 'Community-Freigabe erforderlich'; end if;
  if p_endpoint is null or p_endpoint !~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|([a-z0-9-]+[.])*push[.]apple[.]com|([a-z0-9-]+[.])*notify[.]windows[.]com)(/|$)' or length(p_endpoint) > 2048
     or p_p256dh is null or length(p_p256dh) not between 1 and 256
     or p_auth is null or length(p_auth) not between 1 and 256 then
    raise exception 'Ungültiges Push-Abonnement';
  end if;
  insert into public.drinks_push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id,
    p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;
revoke all on function public.enable_drinks_push(text, text, text) from public, anon;
grant execute on function public.enable_drinks_push(text, text, text) to authenticated;

create table public.drinks_push_attempts (
  send_date date not null,
  endpoint_hash text not null,
  attempted_at timestamptz not null default now(),
  primary key (send_date, endpoint_hash)
);
alter table public.drinks_push_attempts enable row level security;
revoke all on public.drinks_push_attempts from public, anon, authenticated;

-- A claim is recorded before sending: a retry cannot send a duplicate after a timeout.
create function public.claim_drinks_reminders(p_date date)
returns table(endpoint text, p256dh text, auth text)
language sql security definer set search_path = '' as $$
  with cleaned as (
    delete from public.drinks_push_attempts where send_date < p_date - 30
  ), eligible as (
    select subscriptions.endpoint, subscriptions.p256dh, subscriptions.auth
    from public.drinks_push_subscriptions subscriptions
    join public.community_members members on members.user_id = subscriptions.user_id
    where members.status = 'approved' and members.email_confirmed_at is not null
      and exists (
        select 1 from public.community_rsvps rsvps
        join public.tours tours on tours.season_slug = rsvps.season_slug
          and tours.collection_slug = rsvps.collection_slug and tours.id = rsvps.tour_id
        where rsvps.user_id = subscriptions.user_id
          and left(tours.id, 10) <= p_date::text
          and coalesce(tours.end_date::text, left(tours.id, 10)) >= p_date::text
      )
      and not exists (
        select 1 from public.drinks_entries entries
        where entries.user_id = subscriptions.user_id and entries.drink_date = p_date
      )
  ), unclaimed as (
    select endpoint, endpoint_hash from (
      select endpoint, md5(endpoint) as endpoint_hash, row_number() over () as rn from eligible
    ) ranked
    where not exists (select 1 from public.drinks_push_attempts where send_date = p_date and endpoint_hash = ranked.endpoint_hash)
    limit 500
  ), claimed as (
    insert into public.drinks_push_attempts (send_date, endpoint_hash)
    select p_date, endpoint_hash from unclaimed
    returning drinks_push_attempts.endpoint_hash
  )
  select eligible.endpoint, eligible.p256dh, eligible.auth
  from eligible join claimed on claimed.endpoint_hash = md5(eligible.endpoint);
$$;
revoke all on function public.claim_drinks_reminders(date) from public, anon, authenticated;
grant execute on function public.claim_drinks_reminders(date) to service_role;

notify pgrst, 'reload schema';
