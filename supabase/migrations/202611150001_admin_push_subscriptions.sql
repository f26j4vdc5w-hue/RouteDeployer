create table public.admin_push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_push_subscriptions enable row level security;
revoke all on public.admin_push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.admin_push_subscriptions to authenticated;

create policy "Admins can read their own push subscriptions"
  on public.admin_push_subscriptions for select to authenticated
  using (
    user_id = auth.uid()
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Admins can add their own push subscriptions"
  on public.admin_push_subscriptions for insert to authenticated
  with check (
    user_id = auth.uid()
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Admins can update their own push subscriptions"
  on public.admin_push_subscriptions for update to authenticated
  using (
    user_id = auth.uid()
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    user_id = auth.uid()
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Admins can remove their own push subscriptions"
  on public.admin_push_subscriptions for delete to authenticated
  using (
    user_id = auth.uid()
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
