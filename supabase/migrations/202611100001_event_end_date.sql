-- Ein optionales Enddatum gilt ausschließlich für Events und schließt den letzten Tag ein.
alter table public.tours
  add column end_date date,
  add constraint tours_event_end_date_check
    check (
      end_date is null
      or (
        collection_slug = 'events'
        and end_date >= to_date(left(id, 10), 'YYYY-MM-DD')
      )
    );

grant select (end_date) on public.tours to anon, authenticated;

alter policy "Approved members can see tour attendees"
  on public.community_rsvps
  using (
    exists (
      select 1 from public.community_members as members
      where members.user_id = auth.uid()
        and members.status = 'approved'
        and members.email_confirmed_at is not null
    )
    and exists (
      select 1 from public.tours as tours
      where tours.season_slug = community_rsvps.season_slug
        and tours.collection_slug = community_rsvps.collection_slug
        and tours.id = community_rsvps.tour_id
        and coalesce(tours.end_date >= current_date, left(tours.id, 10) >= to_char(current_date, 'YYYY-MM-DD'))
    )
  );

alter policy "Approved members can RSVP for upcoming tours"
  on public.community_rsvps
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.community_members as members
      where members.user_id = auth.uid()
        and members.status = 'approved'
        and members.email_confirmed_at is not null
    )
    and exists (
      select 1 from public.tours as tours
      where tours.season_slug = community_rsvps.season_slug
        and tours.collection_slug = community_rsvps.collection_slug
        and tours.id = community_rsvps.tour_id
        and coalesce(tours.end_date >= current_date, left(tours.id, 10) >= to_char(current_date, 'YYYY-MM-DD'))
    )
  );
