import type { RouteStats } from './route';
import type { PersonalField } from '../shared/personalData';

export interface TourRoute {
  title: string;
  teaser: string;
  /** Name der Person, die die Route geplant hat. */
  plannedBy?: string;
  /** Uhrzeit, z. B. "17:00". */
  meetingTime: string;
  meetingPlace: string;
  /** Orte entlang der Strecke. */
  stations: string[];
  /** Hebt die Route in der Timeline mit einem Stern hervor. */
  highlight?: boolean;
  /** Öffentliche GPX-URL. */
  gpx?: string;
  /** Schlüssel der GPX-Datei im Backend-Speicher. */
  gpxKey?: string;
  routeStats?: RouteStats;
  /** Optional: überschreibt die geschätzte Dauer. */
  durationMin?: number;
}

export interface EventRoute {
  gpxKey: string;
  gpx: string;
  routeStats: RouteStats;
  durationMin?: number;
  stations: string[];
}

export interface Tour extends TourRoute {
  /** Datum im Format YYYY-MM-DD, eindeutig innerhalb einer Kollektion und URL-Parameter. */
  id: string;
  seasonSlug?: string;
  collectionSlug?: string;
  /** Nutzer-ID des Organisators; nur bei Events gesetzt. */
  organizerId?: string;
  /** Externer Link; nur bei Events gesetzt. */
  eventUrl?: string;
  /** Optionales Enddatum eines Events im Format YYYY-MM-DD. */
  endDate?: string;
  /** Pflichtangaben der Teilnehmer; nur bei Events gesetzt. */
  requiredPersonalFields?: PersonalField[];
  /** Zusätzliche GPX-Routen; die erste Route steht in den normalen Routenfeldern. */
  additionalRoutes?: EventRoute[];
  /** Optionale zweite Route für denselben Termin. */
  alternative?: TourRoute;
}
