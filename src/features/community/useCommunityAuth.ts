import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export const COMMUNITY_AUTH_RETURN_TO_KEY = 'community-auth-return-to';
export const COMMUNITY_AUTH_RETURN_TO_SAVED_AT_KEY = 'community-auth-return-to-saved-at';

export interface CommunityMember {
  user_id: string;
  email: string;
  display_name: string;
  full_name: string | null;
  address: string | null;
  birth_date: string | null;
  clothing_size: string | null;
  phone_number: string | null;
  status: 'pending' | 'approved' | 'rejected';
  email_confirmed_at: string | null;
}

export function useCommunityAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [memberLoading, setMemberLoading] = useState(false);
  const [member, setMember] = useState<CommunityMember | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setAuthLoading(false);
    }).catch((cause: unknown) => {
      if (active) {
        setError(cause instanceof Error ? cause.message : 'Die Anmeldung konnte nicht geladen werden.');
        setAuthLoading(false);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setRefreshVersion((version) => version + 1);
      setError(null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!supabase || !userId) {
      setMember(null);
      setMemberLoading(false);
      return;
    }

    let active = true;
    setMemberLoading(true);
    void (async () => {
      try {
        const { data, error: memberError } = await supabase
          .from('community_members')
          .select('user_id, email, display_name, status, email_confirmed_at')
          .eq('user_id', userId)
          .maybeSingle();
        if (!active) return;
        if (memberError) {
          setError(memberError.message);
          setMember(null);
        } else if (!data) {
          setError(null);
          setMember(null);
        } else {
          // Persönliche Angaben sind nicht direkt selektierbar, nur über diese Funktion.
          const { data: details, error: detailsError } = await supabase.rpc('get_my_personal_details').maybeSingle();
          if (!active) return;
          if (detailsError) throw new Error(detailsError.message);
          const personal = details as
            | Pick<CommunityMember, 'full_name' | 'address' | 'birth_date' | 'clothing_size' | 'phone_number'>
            | null;
          setError(null);
          setMember({
            ...(data as Omit<CommunityMember, 'full_name' | 'address' | 'birth_date' | 'clothing_size' | 'phone_number'>),
            full_name: personal?.full_name ?? null,
            address: personal?.address ?? null,
            birth_date: personal?.birth_date ?? null,
            clothing_size: personal?.clothing_size ?? null,
            phone_number: personal?.phone_number ?? null,
          });
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Mitgliedsdaten konnten nicht geladen werden.');
          setMember(null);
        }
      } finally {
        if (active) setMemberLoading(false);
        if (active) setResolvedUserId(userId);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId, refreshVersion]);

  const refresh = useCallback(() => setRefreshVersion((version) => version + 1), []);

  return {
    session,
    member,
    authReady: !authLoading && (!userId || resolvedUserId === userId),
    loading: authLoading || memberLoading,
    error,
    refresh,
  };
}
