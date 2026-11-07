import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Bike,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  IdCard,
  MapPin,
  MessageCircle,
  Mountain,
  Pencil,
  Plus,
  Route as RouteIcon,
  Timer,
  UsersRound,
  Check,
} from 'lucide-react';
import type { RouteStats } from '../../domain/route';
import type { Tour } from '../../domain/tour';
import { formatDateRange, formatLong } from '../../shared/format/date';
import { estimateDurationMin, formatDuration, formatNumber } from '../../shared/format/number';
import { ElevationProfile } from '../elevation-profile/ElevationProfile';
import { GpxDownload } from '../gpx-download/GpxDownload';
import { RouteMap, RouteMapLegend } from '../route-map/RouteMap';
import { WeatherForecast } from '../weather-forecast/WeatherForecast';
import { useTourAttendance } from '../community/useTourAttendance';
import { EventParticipantData } from '../events/EventParticipantData';
import { FinishFlag } from '../events/FinishFlag';
import { useEventChatUrl } from '../events/useEventChatUrl';
import { eventRouteAt, routeDragOffset, swipedRouteIndex } from '../events/eventRoutes';
import type { CommunityMember } from '../community/useCommunityAuth';
import { missingPersonalFields, personalFieldLabel } from '../../shared/personalData';
import { createAscentProfile, getAscentUntilDistance, type AscentProfile } from '../../shared/ascentProfile';
import { parseGpxPoints } from '../../shared/gpx';
import '../events/events.css';

interface Props {
  tour: Tour;
  seasonSlug: string;
  collectionSlug: string;
  memberId: string | null;
  member?: CommunityMember | null;
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
  onEditEvent?: () => void;
  eventRefreshKey?: Tour;
  eventRouteIndex?: number;
  eventRouteCount?: number;
  onEventRouteChange?: (index: number) => void;
}

export function TourDetails({
  tour,
  seasonSlug,
  collectionSlug,
  memberId,
  member,
  position,
  count,
  isPast,
  route,
  durationMin,
  weatherLocation,
  variant,
  onVariantChange,
  onEditEvent,
  eventRefreshKey,
  eventRouteIndex = 0,
  eventRouteCount = 1,
  onEventRouteChange,
}: Props) {
  const isEvent = collectionSlug === 'events';
  const isOrganizer = isEvent && Boolean(memberId) && tour.organizerId === memberId;
  const requiredFields = tour.requiredPersonalFields ?? [];
  const missingFields = member ? missingPersonalFields(requiredFields, member) : requiredFields;
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const closeParticipants = useCallback(() => setParticipantsOpen(false), []);
  const teaserContainerRef = useRef<HTMLDivElement>(null);
  const teaserRef = useRef<HTMLParagraphElement>(null);
  const teaserMeasureRef = useRef<HTMLSpanElement>(null);
  const touchStartRef = useRef<{
    id: number; x: number; y: number; direction: 'pending' | 'horizontal' | 'vertical'; offset: number;
  } | null>(null);
  const [routeDrag, setRouteDrag] = useState<{
    eventKey: string; index: number; offset: number; returning: boolean;
  } | null>(null);
  const [teaserCanExpand, setTeaserCanExpand] = useState(false);
  const [teaserExpanded, setTeaserExpanded] = useState(false);
  const [activeDistanceKm, setActiveDistanceKm] = useState<number | null>(null);
  const [routeTransition, setRouteTransition] = useState<{
    eventKey: string;
    targetIndex: number;
    direction: 'next' | 'previous';
    previousRoute: RouteStats | undefined;
    previousDistanceKm: number | null;
    startOffset: number;
  } | null>(null);
  const [ascentRequested, setAscentRequested] = useState(false);
  const [ascentData, setAscentData] = useState<{
    route: RouteStats;
    gpx: string | undefined;
    profile: AscentProfile | null;
    error: string | null;
  } | null>(null);
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
      onClick={() => {
        if (isEvent && !attendance.isAttending) {
          setConsentChecked(false);
          setConsentOpen((open) => !open);
        } else {
          void attendance.toggleAttendance();
        }
      }}
      disabled={attendance.busy || attendance.loading}
      aria-label={attendance.isAttending ? 'Zusage zurücknehmen' : 'Für diese Tour zusagen'}
      aria-pressed={attendance.isAttending}
      title={attendance.isAttending ? 'Zusage zurücknehmen' : 'Für diese Tour zusagen'}
    >
      {attendance.isAttending ? <Check size={19} /> : <Plus size={19} />}
    </button>
  ) : null;
  const { chatUrl, error: chatError, retry: retryChat } = useEventChatUrl(
    seasonSlug,
    collectionSlug,
    tour.id,
    isEvent && (attendance.isAttending || isOrganizer),
    eventRefreshKey,
  );
  const eventKey = `${seasonSlug}/${collectionSlug}/${tour.id}`;
  const activeTransition = routeTransition?.eventKey === eventKey && routeTransition.targetIndex === eventRouteIndex
    ? routeTransition
    : null;

  const activeDrag = routeDrag?.eventKey === eventKey && routeDrag.index === eventRouteIndex ? routeDrag : null;

  function changeEventRoute(index: number, startOffset = 0) {
    if (!onEventRouteChange || index === eventRouteIndex || index < 0 || index >= eventRouteCount) return;
    touchStartRef.current = null;
    setRouteDrag(null);
    setRouteTransition({
      eventKey,
      targetIndex: index,
      direction: index > eventRouteIndex ? 'next' : 'previous',
      previousRoute: route,
      previousDistanceKm: activeDistanceKm,
      startOffset,
    });
    onEventRouteChange(index);
  }

  useEffect(() => {
    setRouteTransition(null);
    setRouteDrag(null);
    touchStartRef.current = null;
  }, [eventKey]);

  useEffect(() => {
    setActiveDistanceKm(null);
  }, [route]);

  useEffect(() => {
    if (!ascentRequested || !route || route.ascentM === null || route.profile.length < 2) return;
    const controller = new AbortController();
    const gpx = tour.gpx;
    const expectedAscent = route.ascentM;
    setAscentData(null);
    void (async () => {
      try {
        if (!gpx) throw new Error('Für diese Route ist keine GPX-Datei verfügbar.');
        const response = await fetch(gpx, { signal: controller.signal });
        if (!response.ok) throw new Error(`GPX-Datei konnte nicht geladen werden (HTTP ${response.status}).`);
        const profile = createAscentProfile(parseGpxPoints(await response.text()));
        if (Math.abs(profile.ascentM - expectedAscent) > 1) {
          throw new Error('Die GPX-Datei stimmt nicht mit den gespeicherten Höhenmetern überein.');
        }
        if (!controller.signal.aborted) setAscentData({ route, gpx, profile, error: null });
      } catch (cause) {
        if (!controller.signal.aborted) {
          setAscentData({
            route,
            gpx,
            profile: null,
            error: cause instanceof Error ? cause.message : 'Die GPX-Datei konnte nicht ausgewertet werden.',
          });
        }
      }
    })();
    return () => controller.abort();
  }, [ascentRequested, route, tour.gpx]);

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
  const currentAscentData = ascentData && ascentData.route === route && ascentData.gpx === tour.gpx ? ascentData : null;
  const partialAscent =
    isPartialStats && route && currentAscentData?.profile
      ? getAscentUntilDistance(currentAscentData.profile, activeDistanceKm, route.distanceKm)
      : null;
  const partialDuration =
    isPartialStats && durationMin !== null && route
      ? tour.durationMin !== null && tour.durationMin !== undefined
        ? route.distanceKm > 0
          ? durationMin * (activeDistanceKm / route.distanceKm)
          : 0
        : partialAscent !== null || route.ascentM === null
          ? estimateDurationMin(activeDistanceKm, partialAscent)
          : null
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
        isPartialStats
          ? partialDuration !== null ? formatDuration(partialDuration) : '–'
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
        <p className="details__date">{formatDateRange(tour.id, tour.endDate, formatLong)}</p>
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
            <h1 className="details__title">
              {isEvent && <FinishFlag className="details__flag" size={28} />}
              {tour.title}
            </h1>
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

      {((tour.meetingTime || tour.meetingPlace) || attendance.canAttend || chatUrl || eventRouteCount > 1 || (isEvent && tour.eventUrl) || isOrganizer) && (
        <div className={`meeting${isEvent ? ' meeting--event' : ''}`}>
          {(tour.meetingTime || tour.meetingPlace) && (
            <span className="meeting__location">
              <MapPin size={16} />
              {[tour.meetingTime, tour.meetingPlace].filter(Boolean).join(' · ')}
            </span>
          )}
          {chatError && (
            <p className="attendance__error" role="alert">
              {chatError}{' '}
              <button type="button" onClick={retryChat}>Erneut laden</button>
            </p>
          )}
          {(attendance.canAttend || chatUrl || eventRouteCount > 1 || (isEvent && tour.eventUrl) || isOrganizer) && (
            <div className="meeting__actions">
              {isOrganizer && (
                <>
                  <button
                    type="button"
                    className="attendance__people events__organizer-action"
                    onClick={() => setParticipantsOpen(true)}
                    aria-label="Teilnehmerdaten öffnen"
                    title="Teilnehmerdaten öffnen"
                    aria-haspopup="dialog"
                  >
                    <IdCard size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="attendance__people events__organizer-action"
                    onClick={onEditEvent}
                    aria-label="Event bearbeiten"
                    title="Event bearbeiten"
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                </>
              )}
              {eventRouteCount > 1 && (
                <div className="events__route-navigation" role="group" aria-label="Eventrouten">
                  <button type="button" aria-label="Vorherige Route" disabled={eventRouteIndex === 0}
                    onClick={() => changeEventRoute(eventRouteIndex - 1)}>
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                  <span aria-live="polite">
                    <span className="events__route-number">{eventRouteIndex + 1}</span>
                    {' von '}
                    <span className="events__route-number">{eventRouteCount}</span>
                  </span>
                  <button type="button" aria-label="Nächste Route" disabled={eventRouteIndex === eventRouteCount - 1}
                    onClick={() => changeEventRoute(eventRouteIndex + 1)}>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
              {isEvent && tour.eventUrl && (
                <a
                  className="attendance__people"
                  href={tour.eventUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Link zu ${tour.title} in neuem Tab öffnen`}
                  title="Link in neuem Tab öffnen"
                >
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              )}
              {chatUrl && (
                <a
                  className="attendance__people attendance__chat"
                  href={chatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp-Chat öffnen"
                  title="WhatsApp-Chat öffnen"
                >
                  <MessageCircle size={16} aria-hidden="true" />
                </a>
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
        </div>
      )}

      {isOrganizer && participantsOpen && (
        <EventParticipantData
          seasonSlug={seasonSlug}
          collectionSlug={collectionSlug}
          tourId={tour.id}
          requiredFields={requiredFields}
          onClose={closeParticipants}
        />
      )}

      {isEvent && consentOpen && !attendance.isAttending && (
        <div className="events__consent" role="group" aria-label="Einwilligung">
          {missingFields.length > 0 ? (
            <p className="attendance__error" role="alert">
              Für die Zusage fehlen plausible Angaben in deinem Profil:{' '}
              {missingFields.map(personalFieldLabel).join(', ')}. Bitte ergänze sie im Community-Profil.
            </p>
          ) : (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(event) => setConsentChecked(event.target.checked)}
                />
                <span>
                  {requiredFields.length > 0
                    ? `Für die Teilnahme sind folgende Angaben erforderlich: ${requiredFields
                        .map(personalFieldLabel)
                        .join(', ')}. Ich willige ein, dass der Organisator dieses Events diese Daten erhält und nutzt.`
                    : 'Für dieses Event werden keine persönlichen Daten erhoben. Ich bin damit einverstanden.'}
                </span>
              </label>
              <button
                type="button"
                disabled={!consentChecked || attendance.busy}
                onClick={() => {
                  setConsentOpen(false);
                  void attendance.toggleAttendance(true);
                }}
              >
                Zusagen
              </button>
            </>
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
          date={tour.id.slice(0, 10)}
          meetingTime={tour.meetingTime}
          place={weatherLocation.place}
          latitude={weatherLocation.latitude}
          longitude={weatherLocation.longitude}
        />
      )}

      {tour.gpx ? (
        <>
          <div className={eventRouteCount > 1 ? 'events__route-container' : undefined}>
            <div
              className={eventRouteCount > 1 ? 'events__route-swipe' : undefined}
              onTouchStart={(event) => {
                if (eventRouteCount < 2 || !eventRefreshKey || !onEventRouteChange || event.touches.length !== 1) {
                  touchStartRef.current = null;
                  setRouteDrag((current) => current ? { ...current, returning: true } : null);
                  return;
                }
                const touch = event.touches[0];
                setRouteTransition(null);
                setRouteDrag(null);
                touchStartRef.current = {
                  id: touch.identifier, x: touch.clientX, y: touch.clientY, direction: 'pending', offset: 0,
                };
              }}
              onTouchMove={(event) => {
                const start = touchStartRef.current;
                if (!start) return;
                if (event.touches.length !== 1) {
                  touchStartRef.current = null;
                  setRouteDrag((current) => current ? { ...current, returning: true } : null);
                  return;
                }
                const touch = Array.from(event.touches).find((item) => item.identifier === start.id);
                if (!touch) return;
                const dx = touch.clientX - start.x;
                const dy = touch.clientY - start.y;
                if (start.direction === 'pending' && Math.max(Math.abs(dx), Math.abs(dy)) >= 8) {
                  start.direction = Math.abs(dx) > Math.abs(dy) * 1.5 ? 'horizontal' : 'vertical';
                }
                if (start.direction !== 'horizontal') return;
                start.offset = routeDragOffset(eventRouteIndex, eventRouteCount, dx, event.currentTarget.clientWidth);
                setRouteDrag(start.offset ? { eventKey, index: eventRouteIndex, offset: start.offset, returning: false } : null);
              }}
              onTouchEnd={(event) => {
                const start = touchStartRef.current;
                const touch = start && Array.from(event.changedTouches).find((item) => item.identifier === start.id);
                if (!start || !touch) return;
                touchStartRef.current = null;
                if (start.direction !== 'horizontal' || !start.offset) return;
                const dy = touch.clientY - start.y;
                const next = swipedRouteIndex(eventRouteIndex, eventRouteCount, start.offset, dy);
                if (next !== null) changeEventRoute(next, start.offset);
                else setRouteDrag({ eventKey, index: eventRouteIndex, offset: start.offset, returning: true });
              }}
              onTouchCancel={() => {
                touchStartRef.current = null;
                setRouteDrag((current) => current ? { ...current, returning: true } : null);
              }}
            >
              <div
                key={`${eventKey}-${eventRouteIndex}`}
                className={activeDrag?.returning ? 'events__route-return' : activeTransition ? `events__route-enter events__route-enter--${activeTransition.direction}` : undefined}
                style={activeDrag
                  ? activeDrag.returning
                    ? { '--route-slide-from': `${activeDrag.offset}px`, '--route-slide-to': '0px' } as CSSProperties
                    : { transform: `translateX(${activeDrag.offset}px)` }
                  : activeTransition?.startOffset
                    ? { '--route-slide-from': `calc(${activeTransition.direction === 'next' ? '100% + 12px' : '-100% - 12px'} + ${activeTransition.startOffset}px)` } as CSSProperties
                    : undefined}
                onAnimationEnd={activeDrag?.returning ? () => setRouteDrag(null) : undefined}
              >
                <RouteMap route={route} activeDistanceKm={activeDistanceKm} showLegend={eventRouteCount <= 1} />
              </div>
              {activeDrag && eventRefreshKey && (
                <div
                  className={`events__route-neighbor${activeDrag.returning ? ' events__route-return' : ''}`}
                  aria-hidden="true"
                  style={activeDrag.returning
                    ? {
                        '--route-slide-from': `calc(${activeDrag.offset < 0 ? '100% + 12px' : '-100% - 12px'} + ${activeDrag.offset}px)`,
                        '--route-slide-to': activeDrag.offset < 0 ? 'calc(100% + 12px)' : 'calc(-100% - 12px)',
                      } as CSSProperties
                    : { transform: `translateX(calc(${activeDrag.offset < 0 ? '100% + 12px' : '-100% - 12px'} + ${activeDrag.offset}px))` }}
                >
                  <RouteMap route={eventRouteAt(eventRefreshKey, eventRouteIndex + (activeDrag.offset < 0 ? 1 : -1)).routeStats}
                    activeDistanceKm={null} showLegend={false} />
                </div>
              )}
              {activeTransition && (
                <div
                  key={`${eventKey}-${eventRouteIndex}-out`}
                  className={`events__route-exit events__route-exit--${activeTransition.direction}`}
                  style={activeTransition.startOffset
                    ? { '--route-slide-from': `${activeTransition.startOffset}px` } as CSSProperties
                    : undefined}
                  aria-hidden="true"
                  onAnimationEnd={() => setRouteTransition(null)}
                >
                  <RouteMap route={activeTransition.previousRoute} activeDistanceKm={activeTransition.previousDistanceKm} showLegend={false} />
                </div>
              )}
            </div>
            {eventRouteCount > 1 && <RouteMapLegend route={route} />}
          </div>
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
              onHoverDistance={(distance) => {
                if (distance !== null) setAscentRequested(true);
                setActiveDistanceKm(distance);
              }}
            />
          )}
          {isPartialStats && route?.ascentM != null && !currentAscentData && (
            <p role="status">Höhenmeter werden geladen …</p>
          )}
          {isPartialStats && currentAscentData?.error && (
            <p className="attendance__error" role="alert">
              Höhenmeter für die Position nicht verfügbar: {currentAscentData.error}
            </p>
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
