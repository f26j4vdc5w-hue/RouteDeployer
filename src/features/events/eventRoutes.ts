import type { Tour } from '../../domain/tour';

export function eventRouteCount(tour: Tour): number {
  return tour.gpx ? 1 + (tour.additionalRoutes?.length ?? 0) : 1;
}

export function eventRouteAt(tour: Tour, index: number): Tour {
  const route = index > 0 ? tour.additionalRoutes?.[index - 1] : undefined;
  return route ? { ...tour, ...route } : tour;
}

export function swipedRouteIndex(
  index: number,
  count: number,
  dx: number,
  dy: number,
): number | null {
  if (count < 2 || Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy) * 1.5) return null;
  const next = index + (dx < 0 ? 1 : -1);
  return next >= 0 && next < count ? next : null;
}
