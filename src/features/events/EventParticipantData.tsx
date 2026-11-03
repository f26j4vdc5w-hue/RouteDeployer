import { Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { requireSupabase } from '../../lib/supabase';
import { isoToGerman } from '../../shared/format/germanInput';

interface Participant {
  user_id: string;
  display_name: string;
  full_name: string | null;
  address: string | null;
  birth_date: string | null;
}

interface Props {
  seasonSlug: string;
  collectionSlug: string;
  tourId: string;
}

function describe(participant: Participant) {
  return [
    participant.full_name || participant.display_name,
    participant.address ? `Adresse: ${participant.address.replace(/\s*\n\s*/g, ', ')}` : null,
    participant.birth_date ? `Geburtsdatum: ${isoToGerman(participant.birth_date)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function EventParticipantData({ seasonSlug, collectionSlug, tourId }: Props) {
  const [participants, setParticipants] = useState<Participant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      await navigator.clipboard.writeText(participants.map(describe).join('\n\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Das Kopieren in die Zwischenablage ist fehlgeschlagen.');
    }
  }

  return (
    <div className="attendance__list events__participants">
      <h2>Teilnehmerdaten</h2>
      {error ? (
        <p className="attendance__error" role="alert">{error}</p>
      ) : !participants ? (
        <p role="status">Daten werden geladen …</p>
      ) : participants.length === 0 ? (
        <p>Noch keine Teilnehmer mit Einwilligung.</p>
      ) : (
        <>
          <ul>
            {participants.map((participant) => (
              <li key={participant.user_id} className="events__participant">
                <b>{participant.full_name || participant.display_name}</b>
                <span>{participant.address ? participant.address.replace(/\s*\n\s*/g, ', ') : 'Keine Adresse'}</span>
                <span>{participant.birth_date ? isoToGerman(participant.birth_date) : 'Kein Geburtsdatum'}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="events__copy" onClick={copyAll}>
            <Copy size={14} aria-hidden="true" /> {copied ? 'Kopiert' : 'Alle kopieren'}
          </button>
        </>
      )}
    </div>
  );
}
