import { CalendarCheck, CalendarDays, MapPin, Route as RouteIcon } from 'lucide-react';
import type { RouteStats } from '../../domain/route';
import type { Tour } from '../../domain/tour';
import { formatLong } from '../../shared/format/date';
import { estimateDurationMin, formatDuration, formatNumber } from '../../shared/format/number';
import { ElevationProfile } from '../elevation-profile/ElevationProfile';
import { GpxDownload } from '../gpx-download/GpxDownload';
import { RouteMap } from '../route-map/RouteMap';

interface Props {
  tour: Tour;
  position: number;
  count: number;
  isPast: boolean;
  route?: RouteStats;
  variant: 'A' | 'B';
  onVariantChange?: (variant: 'A' | 'B') => void;
}

export function TourDetails({
  tour,
  position,
  count,
  isPast,
  route,
  variant,
  onVariantChange,
}: Props) {
  const durationMin =
    tour.durationMin ?? (route ? estimateDurationMin(route.distanceKm, route.ascentM) : null);
  const stats = [
    { value: route ? formatNumber(route.distanceKm) : '–', unit: 'km', label: 'Länge' },
    {
      value: route?.ascentM != null ? formatNumber(route.ascentM) : '–',
      unit: 'm',
      label: 'Höhenmeter',
    },
    {
      value: durationMin != null ? formatDuration(durationMin) : '–',
      unit: 'h',
      label: 'Dauer ca.',
    },
  ];

  return (
    <article className="details">
      <header className="details__head">
        <div className="details__status">
          <span className="badge">
            {isPast ? <CalendarCheck size={12} /> : <CalendarDays size={12} />}
            {isPast ? 'GEFAHREN' : 'GEPLANT'}
          </span>
          <span>
            ETAPPE {position} / {count}
          </span>
        </div>
        <p className="details__date">{formatLong(tour.id)}</p>
        <div className="details__title-row">
          {onVariantChange && (
            <button
              type="button"
              className="route-variant"
              onClick={() => onVariantChange(variant === 'A' ? 'B' : 'A')}
              aria-label={`Route ${variant === 'A' ? 'B' : 'A'} anzeigen`}
            >
              {variant}
            </button>
          )}
          <h1 className="details__title">{tour.title}</h1>
        </div>
        <p className="details__teaser">{tour.teaser}</p>
      </header>

      <div className="meeting">
        <MapPin size={16} />
        {tour.meetingTime} · {tour.meetingPlace}
      </div>

      {tour.gpx ? (
        <>
          <RouteMap route={route} />

          <div className="stats">
            {stats.map((s) => (
              <div className="stats__item" key={s.label}>
                <div className="stats__value">
                  <b>{s.value}</b>
                  {s.unit}
                </div>
                {s.label}
              </div>
            ))}
          </div>

          <hr className="divider" />

          {route && <ElevationProfile route={route} />}

          <div className="stations">
            <RouteIcon size={15} />
            <span>{tour.stations.join(' → ')}</span>
          </div>

          {route ? (
            <GpxDownload file={tour.gpx} />
          ) : (
            <p className="download__file">GPX folgt in Kürze.</p>
          )}
        </>
      ) : (
        <p className="route-pending" role="status">
          Die Route für diesen Dienstag wird noch bekanntgegeben.
        </p>
      )}

    </article>
  );
}
