create table public.community_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.community_members enable row level security;
revoke all on public.community_members from anon, authenticated;
grant select on public.community_members to authenticated;
grant update (status) on public.community_members to authenticated;

create policy "Members can read their own profile and admins can review all"
  on public.community_members for select to authenticated
  using (
    user_id = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Admins can approve verified community members"
  on public.community_members for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and email_confirmed_at is not null
    and status in ('approved', 'rejected')
  );

create function public.sync_community_member_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.community_members as current_member (
    user_id,
    email,
    display_name,
    status,
    email_confirmed_at
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 60), ''),
      nullif(left(split_part(coalesce(new.email, ''), '@', 1), 60), ''),
      'Community-Mitglied'
    ),
    case
      when new.raw_app_meta_data ->> 'role' = 'admin' then 'approved'
      else 'pending'
    end,
    new.email_confirmed_at
  )
  on conflict (user_id) do update
  set email = excluded.email,
      email_confirmed_at = excluded.email_confirmed_at,
      status = case
        when new.raw_app_meta_data ->> 'role' = 'admin' then 'approved'
        else current_member.status
      end;
  return new;
end;
$$;

revoke all on function public.sync_community_member_from_auth() from public;

create trigger sync_community_member_after_auth_change
  after insert or update on auth.users
  for each row execute function public.sync_community_member_from_auth();

insert into public.community_members (
  user_id,
  email,
  display_name,
  status,
  email_confirmed_at
)
select
  users.id,
  coalesce(users.email, ''),
  coalesce(
    nullif(left(btrim(users.raw_user_meta_data ->> 'display_name'), 60), ''),
    nullif(left(split_part(coalesce(users.email, ''), '@', 1), 60), ''),
    'Community-Mitglied'
  ),
  case
    when users.raw_app_meta_data ->> 'role' = 'admin' then 'approved'
    else 'pending'
  end,
  users.email_confirmed_at
from auth.users as users
on conflict (user_id) do nothing;

create table public.community_rsvps (
  season_slug text not null,
  collection_slug text not null,
  tour_id text not null,
  user_id uuid not null references public.community_members(user_id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (season_slug, collection_slug, tour_id, user_id),
  foreign key (season_slug, collection_slug, tour_id)
    references public.tours(season_slug, collection_slug, id)
    on update cascade on delete cascade
);

create index community_rsvps_tour_idx
  on public.community_rsvps (season_slug, collection_slug, tour_id);

alter table public.community_rsvps enable row level security;
revoke all on public.community_rsvps from anon, authenticated;
grant select, insert, delete on public.community_rsvps to authenticated;

create policy "Approved members can see tour attendees"
  on public.community_rsvps for select to authenticated
  using (
    exists (
      select 1
      from public.community_members as members
      where members.user_id = auth.uid()
        and members.status = 'approved'
        and members.email_confirmed_at is not null
    )
    and exists (
      select 1
      from public.tours as tours
      where tours.season_slug = community_rsvps.season_slug
        and tours.collection_slug = community_rsvps.collection_slug
        and tours.id = community_rsvps.tour_id
        and tours.id >= to_char(current_date, 'YYYY-MM-DD')
    )
  );

create policy "Approved members can RSVP for upcoming tours"
  on public.community_rsvps for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.community_members as members
      where members.user_id = auth.uid()
        and members.status = 'approved'
        and members.email_confirmed_at is not null
    )
    and exists (
      select 1
      from public.tours as tours
      where tours.season_slug = community_rsvps.season_slug
        and tours.collection_slug = community_rsvps.collection_slug
        and tours.id = community_rsvps.tour_id
        and tours.id >= to_char(current_date, 'YYYY-MM-DD')
    )
  );

create policy "Members can cancel their own RSVP"
  on public.community_rsvps for delete to authenticated
  using (user_id = auth.uid());

create function public.set_community_rsvp_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_name text;
begin
  select members.display_name
  into member_name
  from public.community_members as members
  where members.user_id = new.user_id
    and members.status = 'approved'
    and members.email_confirmed_at is not null;

  if member_name is null then
    raise exception 'Only approved, verified community members can RSVP';
  end if;

  new.display_name := member_name;
  return new;
end;
$$;

revoke all on function public.set_community_rsvp_display_name() from public;

create trigger set_community_rsvp_display_name_before_insert
  before insert on public.community_rsvps
  for each row execute function public.set_community_rsvp_display_name();
