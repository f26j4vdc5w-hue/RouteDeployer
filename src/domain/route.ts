export interface RouteStats {
  distanceKm: number;
  ascentM: number | null;
  isLoop: boolean;
  /** Normalisierte Koordinaten (0..1, y nach unten, Seitenverhältnis erhalten). */
  path: [number, number][];
  /** GPS-Koordinaten als [Längengrad, Breitengrad] für die Kartenebene. */
  geoPath: [number, number][];
  /** Paare aus [Kilometer, Höhe in m]. */
  profile: [number, number][];
}

export type RouteIndex = Record<string, RouteStats>;
