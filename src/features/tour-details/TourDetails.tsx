import { useLayoutEffect, useRef, useState } from 'react';
import {
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  MapPin,
  Route as RouteIcon,
} from 'lucide-react';
import type { RouteStats } from '../../domain/route';
import type { Tour } from '../../domain/tour';
import { formatLong } from '../../shared/format/date';
import { formatDuration, formatNumber } from '../../shared/format/number';
import { ElevationProfile } from '../elevation-profile/ElevationProfile';
import { GpxDownload } from '../gpx-download/GpxDownload';
import { RouteMap } from '../route-map/RouteMap';
import { WeatherForecast } from '../weather-forecast/WeatherForecast';

interface Props {
  tour: Tour;
  position: number;
  count: number;
  isPast: boolean;
  route?: RouteStats;
  durationMin: number | null;
  weatherLocation?: {
    place: string;
    latitude: number;
    longitude: number;
  };
  variant: 'A' | 'B';
  onVariantChange?: (variant: 'A' | 'B') => void;
}

export function TourDetails({
  tour,
  position,
  count,
  isPast,
  route,
  durationMin,
  weatherLocation,
  variant,
  onVariantChange,
}: Props) {
  const teaserContainerRef = useRef<HTMLDivElement>(null);
  const teaserRef = useRef<HTMLParagraphElement>(null);
  const teaserMeasureRef = useRef<HTMLSpanElement>(null);
  const [teaserCanExpand, setTeaserCanExpand] = useState(false);
  const [teaserExpanded, setTeaserExpanded] = useState(false);

  useLayoutEffect(() => {
    const container = teaserContainerRef.current;
    const teaser = teaserRef.current;
    const measure = teaserMeasureRef.current;
    if (!container || !teaser || !measure) return;

    setTeaserExpanded(false);
    const updateOverflow = () => {
      const lineHeight = Number.parseFloat(window.getComputedStyle(teaser).lineHeight);
      measure.style.width = `${teaser.clientWidth}px`;
      setTeaserCanExpand(measure.scrollHeight > lineHeight * 2 + 1);
    };

    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(container);

    return () => observer.disconnect();
  }, [tour.teaser]);

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
        <div className="details__teaser-row" ref={teaserContainerRef}>
          <p
            className={`details__teaser${!teaserExpanded ? ' details__teaser--collapsed' : ''}`}
            ref={teaserRef}
          >
            {tour.teaser}
          </p>
          <span className="details__teaser details__teaser-measure" ref={teaserMeasureRef} aria-hidden="true">
            {tour.teaser}
          </span>
          {teaserCanExpand && (
            <button
              type="button"
              className="details__teaser-toggle"
              onClick={() => setTeaserExpanded((expanded) => !expanded)}
              aria-label={teaserExpanded ? 'Teaser einklappen' : 'Teaser vollständig anzeigen'}
              aria-expanded={teaserExpanded}
            >
              {teaserExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </header>

      <div className="meeting">
        <MapPin size={16} />
        {tour.meetingTime} · {tour.meetingPlace}
      </div>

      {weatherLocation && (
        <WeatherForecast
          date={tour.id}
          meetingTime={tour.meetingTime}
          place={weatherLocation.place}
          latitude={weatherLocation.latitude}
          longitude={weatherLocation.longitude}
        />
      )}

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

          {tour.stations.length > 0 && (
            <div className="stations">
              <RouteIcon size={15} />
              <span>{tour.stations.join(' → ')}</span>
            </div>
          )}

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
