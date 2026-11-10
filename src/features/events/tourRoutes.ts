import type { Tour } from '../../domain/tour';

export function tourRouteCount(tour: Tour): number {
  return tour.gpx ? 1 + (tour.additionalRoutes?.length ?? 0) : 1;
}

export function tourRouteAt(tour: Tour, index: number): Tour {
  const route = index > 0 ? tour.additionalRoutes?.[index - 1] : undefined;
  return route ? { ...tour, ...route, durationMin: route.durationMin } : tour;
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

export function routeDragOffset(index: number, count: number, dx: number, width: number): number {
  if ((dx > 0 && index === 0) || (dx < 0 && index >= count - 1) || count < 2) return 0;
  return Math.max(-width, Math.min(width, dx));
}
