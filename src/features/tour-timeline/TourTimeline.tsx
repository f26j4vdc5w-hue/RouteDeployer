import { Check } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Tour } from '../../domain/tour';
import { formatShort } from '../../shared/format/date';

interface Props {
  tours: Tour[];
  selectedId: string;
  today: string;
  onSelect: (id: string) => void;
  onToggleAlternative: (id: string) => void;
  startLabel: string;
  endLabel: string;
}

export function TourTimeline({
  tours,
  selectedId,
  today,
  onSelect,
  onToggleAlternative,
  startLabel,
  endLabel,
}: Props) {
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
      <span className="timeline__label">{startLabel}</span>
      <ol className="timeline__list">
        {tours.map((tour) => {
          const selected = tour.id === selectedId;
          const done = tour.id < today;
          const dotClass = [
            selected ? 'dot--selected' : done ? 'dot--done' : 'dot--upcoming',
            tour.alternative ? 'dot--alternative' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const backDotClass = selected || done ? 'dot--done' : 'dot--upcoming';
          return (
            <li key={tour.id}>
              <button
                ref={selected ? selectedRef : undefined}
                type="button"
                className={`timeline__item${selected ? ' timeline__item--selected' : ''}`}
                aria-current={selected ? 'true' : undefined}
                onClick={() =>
                  selected && tour.alternative ? onToggleAlternative(tour.id) : onSelect(tour.id)
                }
              >
                {tour.alternative ? (
                  <span className="dots dots--alternative" aria-hidden="true">
                    <span className={`dot dot--back ${backDotClass}`} />
                    <span className={`dot dot--front ${dotClass}`}>
                      {done && !selected && <Check size={14} />}
                    </span>
                  </span>
                ) : (
                  <span className={`dot ${dotClass}`}>
                    {done && !selected && <Check size={14} />}
                  </span>
                )}
                <span className="timeline__date">{formatShort(tour.id)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <span className="timeline__label">{endLabel}</span>
    </nav>
  );
}
