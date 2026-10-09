export interface Tour {
  /** Datum im Format YYYY-MM-DD, zugleich eindeutige ID und URL-Parameter. */
  id: string;
  title: string;
  teaser: string;
  /** Uhrzeit, z. B. "17:00". */
  meetingTime: string;
  meetingPlace: string;
  /** Orte entlang der Strecke. */
  stations: string[];
  /** Dateiname in public/routes. */
  gpx: string;
  /** Optional: überschreibt die geschätzte Dauer. */
  durationMin?: number;
}
