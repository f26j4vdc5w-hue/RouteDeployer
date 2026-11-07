import { tourEndDate, tourIncludesDate } from '../../shared/format/date';

interface DatedEntry {
  tour: { id: string; endDate?: string };
}

export function weeklyRangeMarkers<T extends DatedEntry>(dates: (string | null)[], entries: T[]) {
  const visibleDates = dates.filter((date): date is string => date !== null);
  if (visibleDates.length === 0) return dates.map(() => [] as (T | null)[]);

  const first = visibleDates[0];
  const last = visibleDates[visibleDates.length - 1];
  const ranges = entries
    .filter(({ tour }) => tourEndDate(tour) > tour.id.slice(0, 10)
      && tour.id.slice(0, 10) <= last && tourEndDate(tour) >= first)
    .slice()
    .sort((a, b) => a.tour.id.localeCompare(b.tour.id) || tourEndDate(a.tour).localeCompare(tourEndDate(b.tour)));

  const laneEnds: string[] = [];
  const assigned = ranges.map((entry) => {
    const start = entry.tour.id.slice(0, 10);
    let lane = laneEnds.findIndex((end) => end < start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = tourEndDate(entry.tour);
    return { entry, lane };
  });

  return dates.map((date) => {
    const lanes: (T | null)[] = Array.from({ length: laneEnds.length }, () => null);
    if (date) {
      for (const { entry, lane } of assigned) {
        if (tourIncludesDate(entry.tour, date)) lanes[lane] = entry;
      }
    }
    return lanes;
  });
}
