import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import type { Collection, Season } from '../../domain/catalog';
import type { Tour } from '../../domain/tour';
import { todayIso } from '../../shared/format/date';
import './calendar.css';

interface CalendarEntry {
  season: Season;
  collection: Collection;
  tour: Tour;
}

interface Month {
  key: string;
  year: number;
  month: number;
  label: string;
}

interface Props {
  seasons: Season[];
  selectedId: string;
  onSelect: (season: Season, collection: Collection, tourId: string) => void;
  onClose: () => void;
}

const monthFormatter = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortMonthFormatter = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  timeZone: 'UTC',
});
const weekdayFormatter = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  timeZone: 'UTC',
});
const weekdays = Array.from({ length: 7 }, (_, index) =>
  weekdayFormatter.format(new Date(Date.UTC(2024, 0, index + 1))),
);

function monthKey(date: string) {
  return date.slice(0, 7);
}

function createMonths(entries: CalendarEntry[], today: string): Month[] {
  const years = [...entries.map(({ tour }) => Number(tour.id.slice(0, 4))), Number(today.slice(0, 4))];
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years);
  const months: Month[] = [];

  for (let year = firstYear; year <= lastYear; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const date = new Date(Date.UTC(year, month - 1, 1));
      months.push({
        key: `${year}-${String(month).padStart(2, '0')}`,
        year,
        month,
        label: monthFormatter.format(date),
      });
    }
  }
  return months;
}

function monthDays(month: Month) {
  const firstWeekday = new Date(Date.UTC(month.year, month.month - 1, 1)).getUTCDay();
  const offset = (firstWeekday + 6) % 7;
  const daysInMonth = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
}

function isoDate(month: Month, day: number) {
  return `${month.key}-${String(day).padStart(2, '0')}`;
}

export function TourCalendar({ seasons, selectedId, onSelect, onClose }: Props) {
  const today = todayIso();
  const entries = useMemo(
    () =>
      seasons.flatMap((season) =>
        season.collections.flatMap((collection) =>
          collection.tours.map((tour) => ({ season, collection, tour })),
        ),
      ),
    [seasons],
  );
  const months = useMemo(() => createMonths(entries, today), [entries, today]);
  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      const dateEntries = grouped.get(entry.tour.id) ?? [];
      dateEntries.push(entry);
      grouped.set(entry.tour.id, dateEntries);
    }
    return grouped;
  }, [entries]);
  const initialMonth = months.some((month) => month.key === monthKey(selectedId))
    ? monthKey(selectedId)
    : monthKey(today);
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const scrollRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    const container = scrollRef.current;
    const target = monthRefs.current.get(initialMonth);
    if (container && target) container.scrollTop = target.offsetTop;
  }, [initialMonth]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function updateVisibleMonth() {
    const container = scrollRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;
    let activeMonth = months[0]?.key;
    for (const month of months) {
      const element = monthRefs.current.get(month.key);
      if (element && element.offsetTop <= scrollTop + 40) activeMonth = month.key;
      if (element && element.offsetTop > scrollTop + 40) break;
    }
    if (activeMonth) setVisibleMonth(activeMonth);
  }

  function jumpToMonth(key: string) {
    const container = scrollRef.current;
    const target = monthRefs.current.get(key);
    if (!container || !target) return;
    container.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
    setVisibleMonth(key);
  }

  const selectedMonth = months.find((month) => month.key === visibleMonth) ?? months[0];
  const selectedYear = selectedMonth?.year ?? Number(today.slice(0, 4));
  const monthOptions = months.filter((month) => month.year === selectedYear);

  return (
    <div className="tour-calendar__overlay" role="dialog" aria-modal="true" aria-labelledby="tour-calendar-title">
      <button className="tour-calendar__backdrop" type="button" aria-label="Kalender schließen" onClick={onClose} />
      <section className="tour-calendar">
        <header className="tour-calendar__header">
          <div className="tour-calendar__heading">
            <CalendarDays size={20} aria-hidden="true" />
            <h2 id="tour-calendar-title">{selectedMonth?.label ?? 'Kalender'}</h2>
          </div>
          <button className="tour-calendar__close" type="button" onClick={onClose} aria-label="Kalender schließen">
            <X size={20} />
          </button>
          <div className="tour-calendar__jump">
            <label>
              Monat
              <select
                aria-label="Monat auswählen"
                value={selectedMonth?.key ?? ''}
                onChange={(event) => jumpToMonth(event.target.value)}
              >
                {monthOptions.map((month) => (
                  <option value={month.key} key={month.key}>{shortMonthFormatter.format(new Date(Date.UTC(month.year, month.month - 1, 1)))}</option>
                ))}
              </select>
            </label>
            <label>
              Jahr
              <select
                aria-label="Jahr auswählen"
                value={selectedYear}
                onChange={(event) => {
                  const year = Number(event.target.value);
                  const targetMonth = monthOptions.find((month) => month.month === selectedMonth?.month);
                  const nextMonth = months.find((month) => month.year === year && month.month === selectedMonth?.month);
                  jumpToMonth(nextMonth?.key ?? targetMonth?.key ?? `${year}-01`);
                }}
              >
                {[...new Set(months.map((month) => month.year))].map((year) => (
                  <option value={year} key={year}>{year}</option>
                ))}
              </select>
            </label>
          </div>
        </header>
        <div
          className="tour-calendar__scroll"
          ref={scrollRef}
          onScroll={updateVisibleMonth}
          aria-label="Monatskalender"
        >
          {months.map((month) => {
            const days = monthDays(month);
            return (
              <section
                className="tour-calendar__month"
                key={month.key}
                ref={(element) => {
                  if (element) monthRefs.current.set(month.key, element);
                  else monthRefs.current.delete(month.key);
                }}
                aria-label={month.label}
              >
                <h3>{month.label}</h3>
                <div className="tour-calendar__grid" role="grid" aria-label={month.label}>
                  {weekdays.map((weekday, index) => (
                    <span className="tour-calendar__weekday" role="columnheader" key={`${weekday}-${index}`}>
                      {weekday}
                    </span>
                  ))}
                  {days.map((day, index) => {
                    if (day === null) {
                      return <span className="tour-calendar__empty" role="gridcell" key={`empty-${index}`} />;
                    }
                    const date = isoDate(month, day);
                    const dateEntries = entriesByDate.get(date) ?? [];
                    const isToday = date === today;
                    const isSelected = date === selectedId;
                    return (
                      <div
                        className={`tour-calendar__day${isToday ? ' tour-calendar__day--today' : ''}${isSelected ? ' tour-calendar__day--selected' : ''}`}
                        role="gridcell"
                        aria-label={dateEntries.length ? `${day}, ${dateEntries.length} Tour(en)` : String(day)}
                        key={date}
                      >
                        <span className="tour-calendar__day-number">{day}</span>
                        {dateEntries.length > 0 && (
                          <div className="tour-calendar__markers">
                            {dateEntries.map(({ season, collection, tour }) => (
                              <button
                                type="button"
                                className="tour-calendar__marker"
                                style={{ '--marker-color': collection.color } as React.CSSProperties}
                                key={`${season.slug}-${collection.slug}-${tour.id}`}
                                aria-label={`${collection.label}, ${date}: ${tour.title}`}
                                title={`${season.label} · ${collection.label}: ${tour.title}`}
                                onClick={() => onSelect(season, collection, tour.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
