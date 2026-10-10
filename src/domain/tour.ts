export interface TourRoute {
  title: string;
  teaser: string;
  /** Uhrzeit, z. B. "17:00". */
  meetingTime: string;
  meetingPlace: string;
  /** Orte entlang der Strecke. */
  stations: string[];
  /** Relativer GPX-Pfad unter public/routes. */
  gpx?: string;
  /** Optional: überschreibt die geschätzte Dauer. */
  durationMin?: number;
}

export interface Tour extends TourRoute {
  /** Datum im Format YYYY-MM-DD, zugleich eindeutige ID und URL-Parameter. */
  id: string;
  /** Optionale zweite Route für denselben Termin. */
  alternative?: TourRoute;
}
