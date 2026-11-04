-- WhatsApp-Chat-Link eines Events. Die Spalte ist für Clients nicht direkt lesbar (die Tabelle
-- ist öffentlich); der Link wird nur dem Organisator und Mitgliedern mit Zusage ausgeliefert.
alter table public.tours
  add column chat_url text,
  add constraint tours_chat_url_check
    check (
      chat_url is null
      or (
        collection_slug = 'events'
        and chat_url ~* '^https://(chat\.whatsapp\.com|wa\.me|whatsapp\.com/channel)/[A-Za-z0-9_./?=&%-]+$'
      )
    );

-- Spaltenweise Rechte: alles außer chat_url. Neue öffentliche Spalten müssen künftig
-- explizit freigegeben werden.
revoke select on public.tours from anon, authenticated;
grant select (
  id, season_slug, collection_slug, title, teaser, planned_by, meeting_time, meeting_place,
  stations, highlight, duration_min, gpx_key, route_stats, alternative, organizer_id,
  event_url, required_personal_fields
) on public.tours to anon, authenticated;

create function public.get_event_chat_url(
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
