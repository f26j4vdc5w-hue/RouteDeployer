import { useState } from 'react';
import { Bell } from 'lucide-react';

export type PushDeviceType = 'ios' | 'android' | 'desktop';

export function getPushDeviceType(ua: string): PushDeviceType {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function getPushSetupExplanation(deviceType: PushDeviceType, standalone: boolean): string {
  if (deviceType === 'ios') {
    return standalone
      ? 'Öffne „Einstellungen“ oder das App-Menü deines Browsers und erlaube Mitteilungen für Roadbook.'
      : 'Tippe in Safari auf „Teilen“ und dann auf „Zum Home-Bildschirm“. Öffne Roadbook anschließend über das neue App-Symbol.';
  }
  if (deviceType === 'android') {
    return 'Erlaube Mitteilungen im Einblendfenster oder über das Schloss-/Menü-Symbol neben der Adresse. Alternativ kannst du Roadbook über das Browsermenü zum Startbildschirm hinzufügen.';
  }
  return 'Erlaube Mitteilungen, wenn der Browser danach fragt. Du kannst die Berechtigung jederzeit über das Schloss-Symbol links in der Adressleiste ändern.';
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PushNotificationSettings() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deviceType = getPushDeviceType(navigator.userAgent);
  const standalone = isStandalone();
  const supported = window.isSecureContext &&
    'serviceWorker' in navigator &&
    'Notification' in window;
  const iosNeedsInstallation = deviceType === 'ios' && !standalone;

  async function sendTestNotification() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      if (!supported) throw new Error('Push-Benachrichtigungen werden von diesem Gerät oder Browser nicht unterstützt.');
      if (iosNeedsInstallation) throw new Error('Füge Roadbook zuerst über „Zum Home-Bildschirm“ hinzu.');

      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Mitteilungen sind nicht erlaubt. Aktiviere sie in den Browser- oder Geräte-Einstellungen.');

      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      });
      await navigator.serviceWorker.ready;
      await registration.showNotification('Roadbook-Testmitteilung', {
        body: 'Push-Benachrichtigungen funktionieren auf diesem Gerät.',
        icon: `${import.meta.env.BASE_URL}apple-touch-icon.png`,
        tag: 'roadbook-test-notification',
        data: { url: import.meta.env.BASE_URL },
      });
      setNotice('Die Test-Mitteilung wurde gesendet.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die Test-Mitteilung konnte nicht gesendet werden.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card" aria-labelledby="push-notifications-title">
      <h2 className="community__section-title" id="push-notifications-title">Push-Mitteilungen</h2>
      <p className="community__hint">{getPushSetupExplanation(deviceType, standalone)}</p>
      {error && <p className="community__message community__message--error" role="alert">{error}</p>}
      {notice && <p className="community__message" role="status">{notice}</p>}
      <button
        className="community__submit"
        type="button"
        onClick={() => void sendTestNotification()}
        disabled={busy || iosNeedsInstallation || !supported}
      >
        <Bell size={16} aria-hidden="true" />
        {busy ? 'Mitteilung wird gesendet …' : 'Test-Mitteilung senden'}
      </button>
    </section>
  );
}
