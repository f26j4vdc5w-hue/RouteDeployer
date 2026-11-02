export type TourCadence = 'daily' | 'weekly' | '';

export const WEEKDAYS = [
  { value: 1, label: 'Montag' },
  { value: 2, label: 'Dienstag' },
  { value: 3, label: 'Mittwoch' },
  { value: 4, label: 'Donnerstag' },
  { value: 5, label: 'Freitag' },
  { value: 6, label: 'Samstag' },
  { value: 0, label: 'Sonntag' },
] as const;

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(Number(yearText), Number(monthText) - 1, Number(dayText));
  return date.toISOString().slice(0, 10) === value ? date : null;
}

export function generateTourDates(
  startDate: string,
  endDate: string,
  cadence: TourCadence,
  weekdays: number[],
): string[] {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) throw new Error('Bitte gib gültige Start- und Enddaten ein.');
  if (start > end) throw new Error('Das Enddatum muss am Startdatum oder danach liegen.');
  if (!cadence) throw new Error('Bitte wähle einen Rhythmus für die Termine aus.');
  if (cadence === 'weekly' && weekdays.length === 0) {
    throw new Error('Bitte wähle mindestens einen Wochentag aus.');
  }

  const selectedWeekdays = new Set(weekdays);
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (cadence === 'daily' || selectedWeekdays.has(cursor.getUTCDay())) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
