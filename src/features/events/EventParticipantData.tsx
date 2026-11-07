import { Copy, UsersRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { requireSupabase } from '../../lib/supabase';
import { isoToGerman } from '../../shared/format/germanInput';
import type { PersonalField } from '../../shared/personalData';

interface Participant {
  user_id: string;
  display_name: string;
  full_name: string | null;
  email: string | null;
  address: string | null;
  birth_date: string | null;
  clothing_size: string | null;
  phone_number: string | null;
}

interface Props {
  seasonSlug: string;
  collectionSlug: string;
  tourId: string;
  requiredFields: PersonalField[];
  onClose: () => void;
}

function describe(participant: Participant, requiredFields: PersonalField[]) {
  return [
    participant.full_name || participant.display_name,
    requiredFields.includes('email') && participant.email ? `E-Mail: ${participant.email}` : null,
    requiredFields.includes('address') && participant.address
      ? `Adresse: ${participant.address.replace(/\s*\n\s*/g, ', ')}`
      : null,
    requiredFields.includes('birth_date') && participant.birth_date
      ? `Geburtsdatum: ${isoToGerman(participant.birth_date)}`
      : null,
    requiredFields.includes('clothing_size') && participant.clothing_size
      ? `Kleidergröße: ${participant.clothing_size}`
      : null,
    requiredFields.includes('phone_number') && participant.phone_number
      ? `Telefonnummer: ${participant.phone_number}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function EventParticipantData({ seasonSlug, collectionSlug, tourId, requiredFields, onClose }: Props) {
  const [participants, setParticipants] = useState<Participant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab' && panelRef.current) {
        const buttons = panelRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    setParticipants(null);
    setError(null);
    void (async () => {
      const { data, error: rpcError } = await requireSupabase().rpc('get_event_participant_details', {
        p_season_slug: seasonSlug,
        p_collection_slug: collectionSlug,
        p_tour_id: tourId,
      });
      if (!active) return;
      if (rpcError) setError(rpcError.message);
      else setParticipants((data ?? []) as Participant[]);
    })();
    return () => {
      active = false;
    };
  }, [seasonSlug, collectionSlug, tourId]);

  async function copyAll() {
    if (!participants) return;
    try {
      await navigator.clipboard.writeText(participants.map((p) => describe(p, requiredFields)).join('\n\n'));
      setError(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Das Kopieren in die Zwischenablage ist fehlgeschlagen.');
    }
  }

  return createPortal(
    <div className="events__participants-overlay" role="dialog" aria-modal="true" aria-labelledby="event-participants-title">
      <button className="events__participants-backdrop" type="button" aria-label="Teilnehmerdaten schließen" tabIndex={-1} onClick={onClose} />
      <section className="events__participants" ref={panelRef}>
        <header className="events__participants-header">
          <div className="events__participants-heading">
            <UsersRound size={20} aria-hidden="true" />
            <h2 id="event-participants-title">Teilnehmerdaten</h2>
          </div>
          <button ref={closeRef} className="events__participants-close" type="button" onClick={onClose} aria-label="Teilnehmerdaten schließen">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="events__participants-content">
          {error && <p className="attendance__error" role="alert">{error}</p>}
          {!participants && !error ? (
            <p role="status">Daten werden geladen …</p>
          ) : participants?.length === 0 ? (
            <p>Noch keine Teilnehmer mit Einwilligung.</p>
          ) : participants && participants.length > 0 ? (
            <>
              <ul>
                {participants.map((participant) => (
                  <li key={participant.user_id} className="events__participant">
                    <b>{participant.full_name || participant.display_name}</b>
                    {requiredFields.includes('email') && (
                      <span>{participant.email || 'Keine E-Mail-Adresse'}</span>
                    )}
                    {requiredFields.includes('address') && (
                      <span>
                        {participant.address ? participant.address.replace(/\s*\n\s*/g, ', ') : 'Keine Adresse'}
                      </span>
                    )}
                    {requiredFields.includes('birth_date') && (
                      <span>{participant.birth_date ? isoToGerman(participant.birth_date) : 'Kein Geburtsdatum'}</span>
                    )}
                    {requiredFields.includes('clothing_size') && (
                      <span>{participant.clothing_size ? `Kleidergröße: ${participant.clothing_size}` : 'Keine Kleidergröße'}</span>
                    )}
                    {requiredFields.includes('phone_number') && (
                      <span>{participant.phone_number ? `Telefonnummer: ${participant.phone_number}` : 'Keine Telefonnummer'}</span>
                    )}
                  </li>
                ))}
              </ul>
              <button type="button" className="events__copy" onClick={copyAll}>
                <Copy size={14} aria-hidden="true" /> {copied ? 'Kopiert' : 'Alle kopieren'}
              </button>
            </>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}
