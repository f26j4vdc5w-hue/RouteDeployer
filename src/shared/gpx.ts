export interface GpxPoint {
  lat: number;
  lon: number;
  ele: number | null;
}

const toRad = (degrees: number) => (degrees * Math.PI) / 180;

export function haversineKm(a: GpxPoint, b: GpxPoint) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function parseGpxPoints(xml: string): GpxPoint[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('Die GPX-Datei enthält ungültiges XML.');
  }

  const points: GpxPoint[] = [];
  for (const element of Array.from(document.getElementsByTagName('*'))) {
    if (element.localName !== 'trkpt' && element.localName !== 'rtept') continue;
    const lat = Number(element.getAttribute('lat'));
    const lon = Number(element.getAttribute('lon'));
    const elevation = Number(element.getElementsByTagNameNS('*', 'ele')[0]?.textContent);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) continue;
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) continue;
    points.push({ lat, lon, ele: Number.isFinite(elevation) ? elevation : null });
  }
  if (points.length < 2) {
    throw new Error('Die GPX-Datei muss mindestens zwei gültige Track- oder Routenpunkte enthalten.');
  }
  return points;
}
