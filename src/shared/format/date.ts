const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const long = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const dayMonth = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' });
const short = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
const full = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export const formatLong = (iso: string) => long.format(parse(iso));
export const formatDayMonth = (iso: string) => dayMonth.format(parse(iso));
export const formatShort = (iso: string) => short.format(parse(iso));
export const formatToday = (date: Date) => full.format(date);
export const isoToGermanDate = (iso: string) => full.format(parse(iso));
export const yearOf = (iso: string) => Number(iso.slice(0, 4));
export const todayIso = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

export function formatDateRange(start: string, end: string | undefined, format: (date: string) => string) {
  const startDate = start.slice(0, 10);
  return end && end !== startDate ? `${format(startDate)} – ${format(end)}` : format(startDate);
}

export const tourEndDate = (tour: { id: string; endDate?: string }) => tour.endDate ?? tour.id.slice(0, 10);

export const tourIncludesDate = (tour: { id: string; endDate?: string }, date: string) =>
  tour.id.slice(0, 10) <= date && date <= tourEndDate(tour);
