import { useEffect, useState } from 'react';
import { requireSupabase } from '../../lib/supabase';

// Der Link wird nur für Organisator und Teilnehmer ausgeliefert, daher separat vom Roadbook geladen.
export function useEventChatUrl(
  seasonSlug: string,
  collectionSlug: string,
  tourId: string,
  enabled: boolean,
  refreshKey?: unknown,
) {
  const [chatUrl, setChatUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setChatUrl(null);
    setLoaded(false);
    if (!enabled) return;
    void (async () => {
      const { data, error } = await requireSupabase().rpc('get_event_chat_url', {
        p_season_slug: seasonSlug,
        p_collection_slug: collectionSlug,
        p_tour_id: tourId,
      });
      if (!active) return;
      setChatUrl(error ? null : ((data as string | null) ?? null));
      setLoaded(!error);
    })();
    return () => {
      active = false;
    };
  }, [seasonSlug, collectionSlug, tourId, enabled, refreshKey]);

  return { chatUrl, loaded };
}
