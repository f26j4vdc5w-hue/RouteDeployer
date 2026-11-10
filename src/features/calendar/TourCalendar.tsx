import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import type { Collection, Season } from '../../domain/catalog';
import type { Tour } from '../../domain/tour';
import { todayIso, tourEndDate, tourIncludesDate } from '../../shared/format/date';
import { weeklyRangeMarkers } from './calendarMarkers';
import './calendar.css';

interface CalendarEntry {
  season: Season;
  collection: Collection;
  tour: Tour;
}

interface RangeCalendarEntry extends CalendarEntry {
  campRange?: boolean;
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
  selectedSeasonSlug: string;
  selectedCollectionSlug: string;
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
  const years = [
    ...entries.flatMap(({ tour }) => [Number(tour.id.slice(0, 4)), Number(tourEndDate(tour).slice(0, 4))]),
    Number(today.slice(0, 4)),
  ];
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

function createRangeEntries(entries: CalendarEntry[]): RangeCalendarEntry[] {
  const ranges: RangeCalendarEntry[] = entries
    .filter(({ tour }) => tourEndDate(tour) > tour.id.slice(0, 10));
  const campCollections = new Map<string, CalendarEntry[]>();

  for (const entry of entries) {
    if (entry.collection.slug !== 'camp') continue;
    const key = `${entry.season.slug}/${entry.collection.slug}`;
    const collectionEntries = campCollections.get(key) ?? [];
    collectionEntries.push(entry);
    campCollections.set(key, collectionEntries);
  }

  for (const collectionEntries of campCollections.values()) {
    const sortedEntries = collectionEntries.slice().sort((a, b) => a.tour.id.localeCompare(b.tour.id));
    const first = sortedEntries[0];
    const last = sortedEntries.at(-1);
    if (!first || !last || first.tour.id.slice(0, 10) === last.tour.id.slice(0, 10)) continue;

    ranges.push({
      ...first,
      tour: { ...first.tour, endDate: last.tour.id.slice(0, 10) },
      campRange: true,
    });
  }

  return ranges;
}

export function TourCalendar({ seasons, selectedId, selectedSeasonSlug, selectedCollectionSlug, onSelect, onClose }: Props) {
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
  const rangeEntries = useMemo(() => createRangeEntries(entries), [entries]);
  const campRangeKeys = useMemo(
    () => new Set(rangeEntries.filter((entry) => entry.campRange)
      .map(({ season, collection }) => `${season.slug}/${collection.slug}`)),
    [rangeEntries],
  );
  const months = useMemo(() => createMonths(entries, today), [entries, today]);
  const selectedTour = entries.find(({ season, collection, tour }) =>
    season.slug === selectedSeasonSlug && collection.slug === selectedCollectionSlug && tour.id === selectedId,
  )?.tour;
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
            const rangeMarkers = days.flatMap((_, index) =>
              index % 7 === 0
                ? weeklyRangeMarkers(
                    days.slice(index, index + 7).map((day) => day === null ? null : isoDate(month, day)),
                    rangeEntries,
                  )
                : [],
            );
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
                    const dateEntries = entries.filter(({ tour }) => tourIncludesDate(tour, date));
                    const singleDayEntries = dateEntries.filter(({ season, collection, tour }) =>
                      tourEndDate(tour) === tour.id.slice(0, 10)
                      && !campRangeKeys.has(`${season.slug}/${collection.slug}`),
                    );
                    const isToday = date === today;
                    const isSelected = selectedTour ? tourIncludesDate(selectedTour, date) : date === selectedId.slice(0, 10);
                    return (
                      <div
                        className={`tour-calendar__day${isToday ? ' tour-calendar__day--today' : ''}${isSelected ? ' tour-calendar__day--selected' : ''}`}
                        role="gridcell"
                        aria-label={dateEntries.length ? `${day}, ${dateEntries.length} Tour(en)` : String(day)}
                        key={date}
                      >
                        <span className="tour-calendar__day-number">{day}</span>
                        {rangeMarkers[index].length > 0 && (
                          <div className="tour-calendar__ranges">
                            {rangeMarkers[index].map((entry, lane) => {
                              if (!entry) {
                                return <span className="tour-calendar__range-empty" key={`empty-${lane}`} />;
                              }
                              const dayEntry = entry.campRange
                                ? dateEntries.find(({ season, collection }) =>
                                  season.slug === entry.season.slug && collection.slug === entry.collection.slug,
                                )
                                : undefined;
                              const selectedEntry = dayEntry ?? entry;
                              return (
                                <button
                                  type="button"
                                  className={`tour-calendar__range${date === entry.tour.id.slice(0, 10) ? ' tour-calendar__range--start' : ''}${date === tourEndDate(entry.tour) ? ' tour-calendar__range--end' : ''}`}
                                  style={{ '--marker-color': entry.collection.color } as React.CSSProperties}
                                  key={`${entry.season.slug}-${entry.collection.slug}-${entry.tour.id}`}
                                  aria-label={`${selectedEntry.collection.label}, ${date}: ${selectedEntry.tour.title}`}
                                  title={`${selectedEntry.season.label} · ${selectedEntry.collection.label}: ${selectedEntry.tour.title}`}
                                  onClick={() => onSelect(selectedEntry.season, selectedEntry.collection, selectedEntry.tour.id)}
                                />
                              );
                            })}
                          </div>
                        )}
                        {singleDayEntries.length > 0 && (
                          <div className="tour-calendar__markers">
                            {singleDayEntries.map(({ season, collection, tour }) => (
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
