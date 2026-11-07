import { Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Tour } from '../../domain/tour';
import { deleteStoredRoutes, deleteTour, type StoredEventRoute } from '../../data/backend';
import type { RouteStats } from '../../domain/route';
import { requireSupabase } from '../../lib/supabase';
import {
  formatGermanDateInput,
  formatTimeInput,
  isoToGerman,
  isValidTime,
  parseGermanDate,
} from '../../shared/format/germanInput';
import { todayIso } from '../../shared/format/date';
import { PERSONAL_FIELDS, type PersonalField } from '../../shared/personalData';
import { useEventChatUrl } from './useEventChatUrl';
import { analyzeGpx } from '../admin/analyzeGpx';
import '../community/community.css';

interface Props {
  seasonSlug: string;
  collectionSlug: string;
  memberId: string;
  tour?: Tour;
  onClose: () => void;
  onSaved: (tourId: string) => void;
  onDeleted: () => void;
}

const randomSuffix = () => crypto.randomUUID().replace(/-/g, '').slice(0, 6);

interface RouteDraft {
  key: string;
  gpxKey: string | null;
  routeStats: RouteStats | null;
  stations: string;
  duration: string;
  file: File | null;
  removeGpx: boolean;
}

function routeDraft(route?: { gpxKey?: string; routeStats?: RouteStats; stations: string[]; durationMin?: number }): RouteDraft {
  return {
    key: crypto.randomUUID(),
    gpxKey: route?.gpxKey ?? null,
    routeStats: route?.routeStats ?? null,
    stations: route?.stations.join(', ') ?? '',
    duration: route?.durationMin?.toString() ?? '',
    file: null,
    removeGpx: false,
  };
}

function errorText(cause: unknown) {
  if (
    cause && typeof cause === 'object' && 'code' in cause &&
    (cause.code === '42703' || cause.code === 'PGRST204') &&
    'message' in cause && String(cause.message).includes('additional_routes')
  ) {
    return 'Zusätzliche Routen sind noch nicht verfügbar. Bitte zuerst die Supabase-Migration 202611110001_event_additional_routes.sql anwenden.';
  }
  if (
    cause &&
    typeof cause === 'object' &&
    'code' in cause &&
    (cause.code === '42703' || cause.code === 'PGRST204') &&
    'message' in cause &&
    String(cause.message).includes('end_date')
  ) {
    return 'Enddaten sind noch nicht verfügbar. Bitte zuerst die Supabase-Migration 202611100001_event_end_date.sql anwenden.';
  }
  if (
    cause &&
    typeof cause === 'object' &&
    'code' in cause &&
    cause.code === '42703' &&
    'message' in cause &&
    String(cause.message).includes('event_url')
  ) {
    return 'Event-Links sind noch nicht verfügbar. Bitte zuerst die Supabase-Migration 202611060001_event_url.sql anwenden.';
  }
  if (
    cause &&
    typeof cause === 'object' &&
    'code' in cause &&
    cause.code === '42703' &&
    'message' in cause &&
    String(cause.message).includes('required_personal_fields')
  ) {
    return 'Pflichtangaben sind noch nicht verfügbar. Bitte zuerst die Supabase-Migration 202611070001_event_required_personal_data.sql anwenden.';
  }
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === 'object' && 'message' in cause) return String(cause.message);
  return 'Das Event konnte nicht gespeichert werden.';
}

export function EventEditor({
  seasonSlug,
  collectionSlug,
  memberId,
  tour,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [title, setTitle] = useState(tour?.title ?? '');
  const [teaser, setTeaser] = useState(tour?.teaser ?? '');
  const [date, setDate] = useState(tour ? isoToGerman(tour.id.slice(0, 10)) : '');
  const [endDate, setEndDate] = useState(isoToGerman(tour?.endDate));
  const [time, setTime] = useState(tour?.meetingTime ?? '');
  const [place, setPlace] = useState(tour?.meetingPlace ?? '');
  const [eventUrl, setEventUrl] = useState(tour?.eventUrl ?? '');
  const [chatUrl, setChatUrl] = useState('');
  const [chatEdited, setChatEdited] = useState(false);
  const existingChat = useEventChatUrl(
    seasonSlug,
    collectionSlug,
    tour?.id ?? '',
    Boolean(tour) && collectionSlug === 'events',
  );
  const chatValue = chatEdited ? chatUrl : existingChat.chatUrl ?? '';
  const [requiredFields, setRequiredFields] = useState<PersonalField[]>(
    tour?.requiredPersonalFields ?? ['full_name'],
  );
  const [routes, setRoutes] = useState<RouteDraft[]>(() => [
    routeDraft(tour),
    ...(tour?.additionalRoutes ?? []).map(routeDraft),
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRoute(key: string, change: Partial<RouteDraft>) {
    setRoutes((current) => current.map((route) => route.key === key ? { ...route, ...change } : route));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const iso = parseGermanDate(date);
    if (!iso) return setError('Bitte ein gültiges Datum im Format TT.MM.JJJJ eingeben.');
    const unchangedDate = tour && tour.id.slice(0, 10) === iso;
    if (!unchangedDate && iso < todayIso(new Date())) {
      return setError('Das Datum darf nicht in der Vergangenheit liegen.');
    }
    const endIso = collectionSlug === 'events' && endDate.trim() ? parseGermanDate(endDate) : null;
    if (collectionSlug === 'events' && endDate.trim() && !endIso) {
      return setError('Bitte ein gültiges Enddatum im Format TT.MM.JJJJ eingeben.');
    }
    if (endIso && endIso < iso) return setError('Das Enddatum darf nicht vor dem Startdatum liegen.');
    if (time && !isValidTime(time)) return setError('Bitte eine Uhrzeit im Format HH:MM eingeben.');
    const trimmedEventUrl = eventUrl.trim();
    if (collectionSlug === 'events' && trimmedEventUrl) {
      try {
        const parsedUrl = new URL(trimmedEventUrl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          return setError('Der Link muss mit http:// oder https:// beginnen.');
        }
      } catch {
        return setError('Bitte einen gültigen Link eingeben.');
      }
    }
    const trimmedChatUrl = chatValue.trim();
    if (
      collectionSlug === 'events' &&
      trimmedChatUrl &&
      !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com\/channel)\/[A-Za-z0-9_./?=&%-]+$/i.test(trimmedChatUrl)
    ) {
      return setError('Bitte einen WhatsApp-Link angeben (z. B. https://chat.whatsapp.com/…).');
    }
    for (const [index, route] of routes.entries()) {
      const durationMin = route.duration.trim() ? Number(route.duration) : null;
      if (durationMin !== null && (!Number.isSafeInteger(durationMin) || durationMin <= 0 || durationMin > 2147483647)) {
        return setError(`Die Dauer von Route ${index + 1} muss eine positive Zahl (Minuten) sein.`);
      }
      if (routes.length > 1 && !route.file && (!route.gpxKey || route.removeGpx)) {
        return setError(`Bitte für Route ${index + 1} eine GPX-Datei auswählen.`);
      }
      if (routes.length > 1 && !route.file && !route.routeStats) {
        return setError(`Bitte die GPX-Datei für Route ${index + 1} erneut auswählen, um ihre Routendaten zu berechnen.`);
      }
    }

    setBusy(true);
    const uploadedKeys: string[] = [];
    let persisted = false;
    try {
      const client = requireSupabase();
      const suffix = tour?.id.length && tour.id.length > 10 ? tour.id.slice(11) : randomSuffix();
      const id = `${iso}-${suffix}`;

      const preparedRoutes: {
        gpxKey: string | null;
        routeStats: RouteStats | null;
        stations: string[];
        durationMin: number | null;
      }[] = [];
      for (const route of routes) {
        let gpxKey = route.removeGpx ? null : route.gpxKey;
        let routeStats = route.removeGpx ? null : route.routeStats;
        if (route.file) {
          routeStats = await analyzeGpx(route.file);
          const name = route.file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-|-$/g, '');
          gpxKey = `member-events/${memberId}/${crypto.randomUUID()}-${name}`;
          const { error: uploadError } = await client.storage.from('routes').upload(gpxKey, route.file, {
            cacheControl: '3600',
            contentType: 'application/gpx+xml',
            upsert: false,
          });
          if (uploadError) throw uploadError;
          uploadedKeys.push(gpxKey);
        }
        preparedRoutes.push({
          gpxKey,
          routeStats,
          stations: route.stations.split(',').map((station) => station.trim()).filter(Boolean),
          durationMin: route.duration.trim() ? Number(route.duration) : null,
        });
      }
      const primary = preparedRoutes[0];
      const additionalRoutes: StoredEventRoute[] = preparedRoutes.slice(1).map((route) => {
        if (!route.gpxKey || !route.routeStats) throw new Error('Eine zusätzliche Route enthält keine gültigen GPX-Daten.');
        return { ...route, gpxKey: route.gpxKey, routeStats: route.routeStats };
      });

      const values = {
        id,
        title: title.trim(),
        teaser: teaser.trim(),
        meeting_time: time,
        meeting_place: place.trim(),
        stations: primary.stations,
        duration_min: primary.durationMin,
        gpx_key: primary.gpxKey,
        route_stats: primary.routeStats,
        ...(collectionSlug === 'events'
          ? {
              event_url: trimmedEventUrl || null,
              end_date: endIso,
              additional_routes: additionalRoutes,
              ...(!tour || chatEdited ? { chat_url: trimmedChatUrl || null } : {}),
            }
          : {}),
      };
      const requiredPersonalFields = PERSONAL_FIELDS.map((entry) => entry.key).filter((key) =>
        requiredFields.includes(key),
      );

      if (tour) {
        const { error: updateError } = await client
          .from('tours')
          .update(values)
          .eq('id', tour.id)
          .eq('season_slug', seasonSlug)
          .eq('collection_slug', collectionSlug);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await client.from('tours').insert({
          ...values,
          season_slug: seasonSlug,
          collection_slug: collectionSlug,
          organizer_id: memberId,
          highlight: false,
          ...(collectionSlug === 'events' ? { required_personal_fields: requiredPersonalFields } : {}),
        });
        if (insertError) throw insertError;
      }
      persisted = true;

      const oldKeys = [tour?.gpxKey, ...(tour?.additionalRoutes ?? []).map((route) => route.gpxKey)]
        .filter((key): key is string => Boolean(key));
      const retainedKeys = new Set(preparedRoutes.map((route) => route.gpxKey));
      const obsoleteKeys = oldKeys.filter((key) => !retainedKeys.has(key));
      try {
        await deleteStoredRoutes(obsoleteKeys);
      } catch (cleanupError) {
        console.error('Nicht mehr benötigte GPX-Dateien konnten nicht gelöscht werden:', cleanupError);
      }
      onSaved(id);
    } catch (cause) {
      if (!persisted && uploadedKeys.length) {
        try {
          await deleteStoredRoutes(uploadedKeys);
        } catch (cleanupError) {
          console.error('Hochgeladene GPX-Dateien konnten nicht bereinigt werden:', cleanupError);
        }
      }
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!tour) return;
    if (!window.confirm('Dieses Event wirklich löschen? Alle Zusagen gehen verloren.')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteTour(tour);
      onDeleted();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="community__overlay" role="dialog" aria-modal="true" aria-labelledby="event-editor-title">
      <button className="community__backdrop" type="button" aria-label="Schließen" onClick={onClose} />
      <section className="community__panel">
        <header className="community__header">
          <h2 id="event-editor-title">{tour ? 'Event bearbeiten' : 'Event anlegen'}</h2>
          <button className="community__close" type="button" aria-label="Schließen" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="community__content">
          <form className="community__form" onSubmit={save}>
            <label>
              Titel
              <input maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label>
              Beschreibung
              <textarea
                rows={3}
                maxLength={600}
                value={teaser}
                onChange={(e) => setTeaser(e.target.value)}
                required
              />
            </label>
            <label>
              {collectionSlug === 'events' ? 'Startdatum' : 'Datum'}
              <input
                inputMode="numeric"
                placeholder="TT.MM.JJJJ"
                maxLength={10}
                value={date}
                onChange={(e) => setDate(formatGermanDateInput(e.target.value))}
                required
              />
            </label>
            {collectionSlug === 'events' && (
              <label>
                Enddatum (optional)
                <input
                  inputMode="numeric"
                  placeholder="TT.MM.JJJJ"
                  maxLength={10}
                  value={endDate}
                  onChange={(e) => setEndDate(formatGermanDateInput(e.target.value))}
                />
              </label>
            )}
            <label>
              Uhrzeit
              <input
                inputMode="numeric"
                placeholder="HH:MM"
                maxLength={5}
                value={time}
                onChange={(e) => setTime(formatTimeInput(e.target.value))}
              />
            </label>
            <label>
              Treffpunkt
              <input maxLength={120} value={place} onChange={(e) => setPlace(e.target.value)} />
            </label>
            {collectionSlug === 'events' && (
              <label>
                Link (optional)
                <input
                  type="url"
                  maxLength={2048}
                  placeholder="https://beispiel.de"
                  value={eventUrl}
                  onChange={(e) => setEventUrl(e.target.value)}
                />
              </label>
            )}
            {collectionSlug === 'events' && (
              <label>
                WhatsApp-Chat-Link (optional)
                <input
                  type="url"
                  maxLength={2048}
                  placeholder="https://chat.whatsapp.com/…"
                  value={chatValue}
                  onChange={(e) => {
                    setChatEdited(true);
                    setChatUrl(e.target.value);
                  }}
                />
              </label>
            )}
            {collectionSlug === 'events' && (
              <fieldset className="events__fields">
                <legend>Pflichtangaben der Teilnehmer</legend>
                {PERSONAL_FIELDS.map(({ key, label }) => (
                  <label key={key} className="events__check">
                    <input
                      type="checkbox"
                      disabled={Boolean(tour)}
                      checked={requiredFields.includes(key)}
                      onChange={(e) =>
                        setRequiredFields((current) =>
                          e.target.checked ? [...current, key] : current.filter((f) => f !== key),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
                <small>
                  Nur diese Daten sind für dich unter „Teilnehmerdaten“ sichtbar.
                  {tour ? ' Die Auswahl ist nachträglich nicht änderbar.' : ' Die Auswahl lässt sich nach dem Anlegen nicht mehr ändern.'}
                </small>
              </fieldset>
            )}
            {routes.map((route, index) => (
              <fieldset key={route.key} className="events__route-fields">
                <legend>Route {index + 1}</legend>
                <label>
                  Orte (mit Komma getrennt)
                  <input value={route.stations} onChange={(e) => updateRoute(route.key, { stations: e.target.value })} />
                </label>
                <label>
                  Dauer in Minuten (optional)
                  <input
                    inputMode="numeric"
                    value={route.duration}
                    onChange={(e) => updateRoute(route.key, { duration: e.target.value.replace(/\D/g, '') })}
                  />
                </label>
                <label>
                  GPX-Datei {routes.length === 1 ? '(optional)' : ''}
                  <input
                    type="file"
                    accept=".gpx,application/gpx+xml"
                    onChange={(e) => updateRoute(route.key, { file: e.target.files?.[0] ?? null, removeGpx: false })}
                  />
                </label>
                {route.gpxKey && !route.file && (
                  <>
                    <small>Hinterlegte GPX-Datei: {route.gpxKey.split('/').at(-1)}</small>
                    {routes.length === 1 && (
                      <label className="events__check">
                        <input
                          type="checkbox"
                          checked={route.removeGpx}
                          onChange={(e) => updateRoute(route.key, { removeGpx: e.target.checked })}
                        />
                        Bestehende GPX-Datei entfernen
                      </label>
                    )}
                  </>
                )}
                {routes.length > 1 && (
                  <button type="button" className="events__route-remove" onClick={() =>
                    setRoutes((current) => current.filter((entry) => entry.key !== route.key))
                  }>
                    Route {index + 1} entfernen
                  </button>
                )}
              </fieldset>
            ))}
            {collectionSlug === 'events' && (
              <button type="button" className="events__route-add" onClick={() =>
                setRoutes((current) => [...current, routeDraft()])
              }>
                <Plus size={16} aria-hidden="true" /> Weitere Route hinzufügen
              </button>
            )}
            {error && <p className="community__message community__message--error" role="alert">{error}</p>}
            <button className="community__submit" type="submit" disabled={busy}>
              {busy ? 'Wird gespeichert …' : tour ? 'Speichern' : 'Event anlegen'}
            </button>
            {tour && (
              <button
                className="community__submit events__delete"
                type="button"
                onClick={remove}
                disabled={busy}
              >
                Event löschen
              </button>
            )}
          </form>
        </div>
      </section>
    </div>,
    document.body,
  );
}
