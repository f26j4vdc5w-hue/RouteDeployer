import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Bike,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  MapPin,
  Mountain,
  Plus,
  Route as RouteIcon,
  Timer,
  UsersRound,
  Check,
} from 'lucide-react';
import type { RouteStats } from '../../domain/route';
import type { Tour } from '../../domain/tour';
import { formatLong } from '../../shared/format/date';
import { estimateDurationMin, formatDuration, formatNumber } from '../../shared/format/number';
import { ElevationProfile } from '../elevation-profile/ElevationProfile';
import { GpxDownload } from '../gpx-download/GpxDownload';
import { RouteMap } from '../route-map/RouteMap';
import { WeatherForecast } from '../weather-forecast/WeatherForecast';
import { useTourAttendance } from '../community/useTourAttendance';

interface Props {
  tour: Tour;
  seasonSlug: string;
  collectionSlug: string;
  memberId: string | null;
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

function getAscentUntilDistance(route: RouteStats, distanceKm: number) {
  if (route.ascentM === null || route.profile.length < 2) return null;
  if (distanceKm >= route.distanceKm) return route.ascentM;

  let referenceElevation = route.profile[0][1];
  let ascent = 0;
  const addElevation = (elevation: number) => {
    if (elevation - referenceElevation >= 3) {
      ascent += elevation - referenceElevation;
      referenceElevation = elevation;
    } else if (referenceElevation - elevation >= 3) {
      referenceElevation = elevation;
    }
  };

  for (let index = 1; index < route.profile.length; index++) {
    const [previousKm, previousElevation] = route.profile[index - 1];
    const [currentKm, currentElevation] = route.profile[index];
    if (currentKm > distanceKm) {
      const progress = (distanceKm - previousKm) / (currentKm - previousKm);
      addElevation(previousElevation + (currentElevation - previousElevation) * progress);
      break;
    }
    addElevation(currentElevation);
  }

  return Math.round(ascent);
}

export function TourDetails({
  tour,
  seasonSlug,
  collectionSlug,
  memberId,
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
  const [activeDistanceKm, setActiveDistanceKm] = useState<number | null>(null);
  const [attendeeListOpen, setAttendeeListOpen] = useState(false);
  const attendance = useTourAttendance({
    seasonSlug,
    collectionSlug,
    tourId: tour.id,
    userId: memberId,
    isPast,
  });
  const attendanceButton = attendance.canAttend ? (
    <button
      type="button"
      className={`attendance__toggle${attendance.isAttending ? ' attendance__toggle--active' : ''}`}
      onClick={attendance.toggleAttendance}
      disabled={attendance.busy || attendance.loading}
      aria-label={attendance.isAttending ? 'Zusage zurücknehmen' : 'Für diese Tour zusagen'}
      aria-pressed={attendance.isAttending}
      title={attendance.isAttending ? 'Zusage zurücknehmen' : 'Für diese Tour zusagen'}
    >
      {attendance.isAttending ? <Check size={19} /> : <Plus size={19} />}
    </button>
  ) : null;

  useEffect(() => {
    setActiveDistanceKm(null);
  }, [route]);

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

  const isPartialStats = route !== undefined && activeDistanceKm !== null;
  const partialAscent =
    isPartialStats && route ? getAscentUntilDistance(route, activeDistanceKm) : null;
  const partialDuration =
    isPartialStats && durationMin !== null && route
      ? tour.durationMin !== null && tour.durationMin !== undefined
        ? route.distanceKm > 0
          ? durationMin * (activeDistanceKm / route.distanceKm)
          : 0
        : estimateDurationMin(activeDistanceKm, partialAscent)
      : null;
  const stats = [
    {
      value: route
        ? formatNumber(isPartialStats ? activeDistanceKm : route.distanceKm)
        : '–',
      unit: 'km',
      label: 'Distanz',
      icon: 'distance',
    },
    {
      value: isPartialStats
        ? partialAscent !== null
          ? formatNumber(partialAscent)
          : '–'
        : route?.ascentM != null
          ? formatNumber(route.ascentM)
          : '–',
      unit: 'm',
      label: 'Anstieg',
      icon: <Mountain size={14} aria-hidden="true" />,
    },
    {
      value:
        isPartialStats && partialDuration !== null
          ? formatDuration(partialDuration)
          : durationMin != null
            ? formatDuration(durationMin)
            : '–',
      unit: 'h',
      label: 'Dauer ca.',
      icon: <Timer size={14} aria-hidden="true" />,
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
          <div className="details__title-stack">
            <h1 className="details__title">{tour.title}</h1>
            {tour.plannedBy && <span className="details__planner">by {tour.plannedBy}</span>}
          </div>
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

      {((tour.meetingTime || tour.meetingPlace) || attendance.canAttend) && (
        <div className="meeting">
          {(tour.meetingTime || tour.meetingPlace) && (
            <>
              <MapPin size={16} />
              {[tour.meetingTime, tour.meetingPlace].filter(Boolean).join(' · ')}
            </>
          )}
          {attendance.canAttend && (
            <button
              type="button"
              className="attendance__people"
              onClick={() => setAttendeeListOpen((open) => !open)}
              aria-label={`${attendance.attendees.length} Zusagen anzeigen`}
              aria-expanded={attendeeListOpen}
              aria-controls="tour-attendees"
              disabled={attendance.loading}
            >
              <UsersRound size={16} aria-hidden="true" />
              <span>{attendance.attendees.length}</span>
            </button>
          )}
        </div>
      )}

      {attendance.canAttend && attendeeListOpen && (
        <div className="attendance__list" id="tour-attendees">
          <h2>Wer ist dabei?</h2>
          {attendance.loading ? (
            <p role="status">Zusagen werden geladen …</p>
          ) : attendance.attendees.length > 0 ? (
            <ul>
              {attendance.attendees.map((attendee) => (
                <li key={attendee.user_id}>
                  <Bike size={14} aria-hidden="true" />
                  {attendee.display_name}
                </li>
              ))}
            </ul>
          ) : (
            <p>Noch keine Zusagen.</p>
          )}
        </div>
      )}

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
          <RouteMap route={route} activeDistanceKm={activeDistanceKm} />

          <div className={`stats${isPartialStats ? ' stats--partial' : ''}`}>
            {stats.map((s) => (
              <div className="stats__item" key={s.label}>
                <div className="stats__value">
                  <b>{s.value}</b>
                  {s.unit}
                </div>
                <div className="stats__label">
                  {s.icon === 'distance' ? (
                    <svg
                      className="stats__icon"
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path d="M2.5 2v10M11.5 2v10M4.5 7h5M7.5 5l2 2-2 2" />
                    </svg>
                  ) : (
                    <span className="stats__icon">{s.icon}</span>
                  )}
                  <span>{s.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* <hr className="divider" /> */}

          {route && (
            <ElevationProfile
              route={route}
              activeDistanceKm={activeDistanceKm}
              onHoverDistance={setActiveDistanceKm}
            />
          )}

          {tour.stations.length > 0 && (
            <div className="stations">
              <RouteIcon size={15} />
              <span>{tour.stations.join(' → ')}</span>
            </div>
          )}

          {route ? (
            <GpxDownload file={tour.gpx} action={attendanceButton} />
          ) : (
            <div className="download__actions">
              <p className="download__file">GPX folgt in Kürze.</p>
              {attendanceButton}
            </div>
          )}
          {attendance.error && <p className="attendance__error" role="alert">{attendance.error}</p>}
        </>
      ) : (
        <>
          <p className="route-pending" role="status">
            Details zu dieser Tour werden noch bekanntgegeben.
          </p>
          <div className="download__actions">{attendanceButton}</div>
          {attendance.error && <p className="attendance__error" role="alert">{attendance.error}</p>}
        </>
      )}

    </article>
  );
}
