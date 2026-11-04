import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

// Offene Freigaben: nur Konten mit bestätigter E-Mail lassen sich freigeben.
export function usePendingMemberCount(isAdmin: boolean, refreshKey?: unknown) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAdmin || !supabase) {
      setCount(0);
      return;
    }
    let active = true;
    void supabase
      .from('community_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .not('email_confirmed_at', 'is', null)
      .then(({ count: total, error }) => {
        if (active) setCount(error ? 0 : total ?? 0);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, refreshKey]);

  return count;
}
