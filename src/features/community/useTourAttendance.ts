import { useCallback, useEffect, useState } from 'react';
import { requireSupabase } from '../../lib/supabase';

export interface TourAttendee {
  user_id: string;
  display_name: string;
}

interface Props {
  seasonSlug: string;
  collectionSlug: string;
  tourId: string;
  userId: string | null;
  isPast: boolean;
}

export function useTourAttendance({
  seasonSlug,
  collectionSlug,
  tourId,
  userId,
  isPast,
}: Props) {
  const [attendees, setAttendees] = useState<TourAttendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const canAttend = Boolean(userId) && !isPast;

  useEffect(() => {
    let active = true;
    if (!userId || isPast) {
      setAttendees([]);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
      };
    }

    setAttendees([]);
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const { data, error: queryError } = await requireSupabase()
          .from('community_rsvps')
          .select('user_id, display_name')
          .eq('season_slug', seasonSlug)
          .eq('collection_slug', collectionSlug)
          .eq('tour_id', tourId)
          .order('created_at', { ascending: true });
        if (queryError) throw queryError;
        if (active) setAttendees((data ?? []) as TourAttendee[]);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Die Zusagen konnten nicht geladen werden.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [collectionSlug, isPast, refreshVersion, seasonSlug, tourId, userId]);

  const toggleAttendance = useCallback(async (sharePersonalData = false) => {
    if (!userId || isPast || busy || loading) return;
    setBusy(true);
    setError(null);
    try {
      const client = requireSupabase();
      const alreadyAttending = attendees.some((attendee) => attendee.user_id === userId);
      const result = alreadyAttending
        ? await client
            .from('community_rsvps')
            .delete()
            .eq('season_slug', seasonSlug)
            .eq('collection_slug', collectionSlug)
            .eq('tour_id', tourId)
            .eq('user_id', userId)
        : await client.from('community_rsvps').insert({
            season_slug: seasonSlug,
            collection_slug: collectionSlug,
            tour_id: tourId,
            user_id: userId,
            display_name: '',
            ...(sharePersonalData ? { share_personal_data: true } : {}),
          });
      if (result.error) throw result.error;
      setRefreshVersion((version) => version + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Deine Zusage konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }, [attendees, busy, collectionSlug, isPast, loading, seasonSlug, tourId, userId]);

  return {
    attendees,
    canAttend,
    loading,
    busy,
    error,
    isAttending: userId ? attendees.some((attendee) => attendee.user_id === userId) : false,
    toggleAttendance,
  };
}
