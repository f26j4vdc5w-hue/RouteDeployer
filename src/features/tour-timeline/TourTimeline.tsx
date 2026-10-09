import { Check } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Tour } from '../../domain/tour';
import { formatShort } from '../../shared/format/date';

interface Props {
  tours: Tour[];
  selectedId: string;
  today: string;
  onSelect: (id: string) => void;
}

export function TourTimeline({ tours, selectedId, today, onSelect }: Props) {
  const timelineRef = useRef<HTMLElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timeline = timelineRef.current;
    const selected = selectedRef.current;
    if (!timeline || !selected) return;

    const timelineBounds = timeline.getBoundingClientRect();
    const selectedBounds = selected.getBoundingClientRect();

    if (selectedBounds.top < timelineBounds.top) {
      timeline.scrollTop += selectedBounds.top - timelineBounds.top;
    } else if (selectedBounds.bottom > timelineBounds.bottom) {
      timeline.scrollTop += selectedBounds.bottom - timelineBounds.bottom;
    }
  }, [selectedId]);

  return (
    <nav ref={timelineRef} className="timeline" aria-label="Dienstage">
      <span className="timeline__label">SAISONBEGINN</span>
      <ol className="timeline__list">
        {tours.map((tour) => {
          const selected = tour.id === selectedId;
          const done = tour.id < today;
          const dotClass = selected ? 'dot--selected' : done ? 'dot--done' : 'dot--upcoming';
          return (
            <li key={tour.id}>
              <button
                ref={selected ? selectedRef : undefined}
                type="button"
                className={`timeline__item${selected ? ' timeline__item--selected' : ''}`}
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelect(tour.id)}
              >
                <span className={`dot ${dotClass}`}>
                  {done && !selected && <Check size={14} />}
                </span>
                {formatShort(tour.id)}
              </button>
            </li>
          );
        })}
      </ol>
      <span className="timeline__label">SAISONENDE</span>
    </nav>
  );
}
