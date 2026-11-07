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
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setChatUrl(null);
    setLoaded(false);
    setError(null);
    if (!enabled) return;
    void (async () => {
      try {
        const { data, error: queryError } = await requireSupabase().rpc('get_event_chat_url', {
          p_season_slug: seasonSlug,
          p_collection_slug: collectionSlug,
          p_tour_id: tourId,
        });
        if (queryError) throw queryError;
        if (data !== null && typeof data !== 'string') {
          throw new Error('Die Serverantwort enthält keinen gültigen Chat-Link.');
        }
        if (!active) return;
        setChatUrl(data);
        setLoaded(true);
      } catch (cause) {
        if (!active) return;
        console.error('WhatsApp-Chat-Link konnte nicht geladen werden:', cause);
        setError('Der WhatsApp-Chat-Link konnte nicht geladen werden. Bitte erneut versuchen.');
      }
    })();
    return () => {
      active = false;
    };
  }, [seasonSlug, collectionSlug, tourId, enabled, refreshKey, retryVersion]);

  return { chatUrl, loaded, error, retry: () => setRetryVersion((version) => version + 1) };
}
