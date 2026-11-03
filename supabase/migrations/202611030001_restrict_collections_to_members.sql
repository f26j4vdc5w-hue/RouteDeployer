-- Öffentlich sichtbar bleibt nur die Kollektion "after-work".
-- Alle anderen Kollektionen und deren Touren sehen nur Admins sowie
-- freigegebene Mitglieder mit bestätigter E-Mail-Adresse.

create or replace function public.can_read_all_collections()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    or exists (
      select 1
      from public.community_members as members
      where members.user_id = (select auth.uid())
        and members.status = 'approved'
        and members.email_confirmed_at is not null
    );
$$;

revoke all on function public.can_read_all_collections() from public;
grant execute on function public.can_read_all_collections() to anon, authenticated;

drop policy "Public can read collections" on public.collections;
create policy "Public can read the after-work collection, members read all"
  on public.collections for select to anon, authenticated
  using (slug = 'after-work' or public.can_read_all_collections());

drop policy "Public can read tours" on public.tours;
create policy "Public can read after-work tours, members read all"
  on public.tours for select to anon, authenticated
  using (collection_slug = 'after-work' or public.can_read_all_collections());
