import { ChevronDown, CalendarDays } from 'lucide-react';
import type { Tour } from '../../domain/tour';
import { formatDayMonth } from '../../shared/format/date';

interface Props {
  years: number[];
  year: number;
  tours: Tour[];
  selectedId: string;
  onYearChange: (year: number) => void;
  onTourChange: (id: string) => void;
}

export function SeasonPicker({ years, year, tours, selectedId, onYearChange, onTourChange }: Props) {
  return (
    <section className="season">
      <div className="season__meta">
        <span>Unser Roadbook</span>
        <span>Jeden Dienstag.</span>
      </div>
      <div className="season__controls">
        <label className="select select--season">
          <select
            aria-label="Saison"
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                Saison {y}
              </option>
            ))}
          </select>
          <ChevronDown className="select__icon select__icon--right" size={14} />
        </label>
        <label className="select select--date">
          <CalendarDays className="select__icon select__icon--left" size={16} />
          <select
            aria-label="Dienstag"
            value={selectedId}
            onChange={(e) => onTourChange(e.target.value)}
          >
            {tours.map((t) => (
              <option key={t.id} value={t.id}>
                {formatDayMonth(t.id)}
              </option>
            ))}
          </select>
          <ChevronDown className="select__icon select__icon--right" size={14} />
        </label>
      </div>
    </section>
  );
}
