-- Die Spalte kann bereits vorhanden sein, auch wenn die Lesefunktion fehlt.
create or replace function public.get_event_chat_url(
  p_season_slug text,
  p_collection_slug text,
  p_tour_id text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select tours.chat_url
  from public.tours as tours
  where tours.season_slug = p_season_slug
    and tours.collection_slug = p_collection_slug
    and tours.collection_slug = 'events'
    and tours.id = p_tour_id
    and (
      tours.organizer_id = (select auth.uid())
      or exists (
        select 1
        from public.community_rsvps as rsvps
        where rsvps.season_slug = tours.season_slug
          and rsvps.collection_slug = tours.collection_slug
          and rsvps.tour_id = tours.id
          and rsvps.user_id = (select auth.uid())
      )
    );
$$;

revoke all on function public.get_event_chat_url(text, text, text) from public, anon;
grant execute on function public.get_event_chat_url(text, text, text) to authenticated;

notify pgrst, 'reload schema';
