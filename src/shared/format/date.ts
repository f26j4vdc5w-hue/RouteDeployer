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
export const yearOf = (iso: string) => Number(iso.slice(0, 4));
export const todayIso = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
