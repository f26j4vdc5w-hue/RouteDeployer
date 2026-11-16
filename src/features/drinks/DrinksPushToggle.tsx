import { useEffect, useState } from 'react';
import { requireSupabase } from '../../lib/supabase';
import { keyToBytes } from '../admin/AdminPushToggle';

const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function DrinksPushToggle({ userId }: { userId: string }) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(publicKey);

  useEffect(() => {
    if (!supported) return;
    let active = true;
    setBusy(true);
    async function initialize() {
      try {
        const worker = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
        await navigator.serviceWorker.ready;
        const current = await worker.pushManager.getSubscription();
        let isEnabled = false;
        if (current) {
          const result = await requireSupabase().from('drinks_push_subscriptions').select('endpoint').eq('endpoint', current.endpoint).eq('user_id', userId).maybeSingle();
          if (result.error) throw result.error;
          isEnabled = Boolean(result.data);
        }
        if (active) { setRegistration(worker); setSubscription(current); setEnabled(isEnabled); }
      } catch (cause) {
        if (active) setError(cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : 'Erinnerungen konnten nicht überprüft werden.');
      } finally { if (active) setBusy(false); }
    }
    void initialize();
    return () => { active = false; };
  }, [supported, userId]);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (!registration || !publicKey) throw new Error('Mitteilungen sind noch nicht bereit.');
      if (enabled && subscription) {
        const result = await requireSupabase().from('drinks_push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        if (result.error) throw result.error;
        setEnabled(false);
      } else {
        const current = subscription ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
        setSubscription(current);
        const keys = current.toJSON().keys;
        if (!keys?.p256dh || !keys.auth) throw new Error('Das Gerät hat keine gültigen Push-Schlüssel geliefert.');
        const result = await requireSupabase().rpc('enable_drinks_push', { p_endpoint: current.endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth });
        if (result.error) throw result.error;
        setEnabled(true);
      }
    } catch (cause) {
      setError(cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : 'Erinnerungen konnten nicht geändert werden.');
    } finally { setBusy(false); }
  }

  if (!supported) return <p>Push-Erinnerungen sind auf diesem Gerät nicht verfügbar oder noch nicht eingerichtet. Auf dem iPhone muss die App zum Home-Bildschirm hinzugefügt und dort geöffnet werden.</p>;
  return <div>
    <button className="admin-button" disabled={busy || !registration} onClick={() => void toggle()}>{enabled ? 'Erinnerung auf diesem Gerät ausschalten' : 'Erinnerung auf diesem Gerät aktivieren'}</button>
    {error && <p className="admin-error" role="alert">{error}</p>}
  </div>;
}
