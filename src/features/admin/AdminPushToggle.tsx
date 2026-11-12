import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { requireSupabase } from '../../lib/supabase';

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function keyToBytes(base64Url: string) {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  return registration ? registration.pushManager.getSubscription() : null;
}

export function AdminPushToggle({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [deviceSubscription, setDeviceSubscription] = useState<PushSubscription | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(vapidPublicKey);
  const standalone = window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);

  useEffect(() => {
    if (!supported) return;
    let active = true;
    setBusy(true);
    async function initialize() {
      try {
        const worker = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
          scope: import.meta.env.BASE_URL,
        });
        await navigator.serviceWorker.ready;
        const subscription = await worker.pushManager.getSubscription();
        let isEnabled = false;
        if (subscription) {
          const { data, error } = await requireSupabase()
            .from('admin_push_subscriptions')
            .select('endpoint')
            .eq('endpoint', subscription.endpoint)
            .eq('user_id', userId)
            .maybeSingle();
          if (error) throw error;
          isEnabled = Boolean(data);
        }
        if (active) {
          setRegistration(worker);
          setDeviceSubscription(subscription);
          setEnabled(isEnabled);
        }
      } catch (cause) {
        if (active) setMessage(cause instanceof Error ? cause.message : 'Mitteilungen konnten nicht überprüft werden.');
      } finally {
        if (active) setBusy(false);
      }
    }
    void initialize();
    return () => { active = false; };
  }, [supported, userId]);

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      if (!registration || !vapidPublicKey) throw new Error('Mitteilungen sind noch nicht bereit.');
      const subscription =
        deviceSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyToBytes(vapidPublicKey),
        }));
      setDeviceSubscription(subscription);
      const json = subscription.toJSON();
      if (!json.keys?.p256dh || !json.keys.auth) {
        throw new Error('Das Gerät hat keine gültigen Push-Schlüssel geliefert.');
      }
      const { error } = await requireSupabase().from('admin_push_subscriptions').upsert({
        endpoint: subscription.endpoint,
        user_id: userId,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      });
      if (error) throw error;
      setEnabled(true);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Mitteilungen konnten nicht aktiviert werden.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        const { error } = await requireSupabase()
          .from('admin_push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);
        if (error) throw error;
        if (!(await subscription.unsubscribe())) {
          throw new Error('Das Gerät konnte das Push-Abonnement nicht entfernen.');
        }
      }
      setDeviceSubscription(null);
      setEnabled(false);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Mitteilungen konnten nicht deaktiviert werden.');
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return isIos && !standalone ? (
      <p className="admin-muted">
        Für Mitteilungen die App über „Teilen → Zum Home-Bildschirm“ hinzufügen und von dort öffnen.
      </p>
    ) : (
      <p className="admin-muted">Mitteilungen sind auf diesem Gerät nicht verfügbar oder noch nicht eingerichtet.</p>
    );
  }

  return (
    <>
      <button type="button" className="admin-button" onClick={enabled ? disable : enable} disabled={busy || !registration}>
        {enabled ? <BellOff size={16} aria-hidden="true" /> : <Bell size={16} aria-hidden="true" />}
        {enabled ? 'Mitteilungen aus' : 'Mitteilungen aktivieren'}
      </button>
      {message && <p className="admin-error" role="alert">{message}</p>}
    </>
  );
}
