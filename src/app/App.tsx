import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Collection, Season } from '../domain/catalog';
import type { Tour } from '../domain/tour';
import { deleteTour, fetchRoadbook } from '../data/backend';
import { LoadingScreen } from './LoadingScreen';
import { supabase } from '../lib/supabase';
import { TourCalendar } from '../features/calendar/TourCalendar';
import { CollectionSwitcher } from '../features/collection-switcher/CollectionSwitcher';
import { TourDetails } from '../features/tour-details/TourDetails';
import { TourTimeline } from '../features/tour-timeline/TourTimeline';
import { CommunityAccount } from '../features/community/CommunityAccount';
import { EventEditor } from '../features/events/EventEditor';
import { tourRouteAt, tourRouteCount } from '../features/events/tourRoutes';
import {
  COMMUNITY_AUTH_RETURN_TO_KEY,
  COMMUNITY_AUTH_RETURN_TO_SAVED_AT_KEY,
  useCommunityAuth,
} from '../features/community/useCommunityAuth';
import { todayIso, tourEndDate } from '../shared/format/date';
import { estimateDurationMin } from '../shared/format/number';

const BASE = import.meta.env.BASE_URL;
const CollectionTourEditor = lazy(() =>
  import('../features/admin/AdminApp').then((module) => ({ default: module.TourEditor })),
);
const CHEMNITZ_WEATHER_LOCATION = {
  place: 'Chemnitz',
  latitude: 50.8278,
  longitude: 12.9214,
};

interface Location {
  season: Season;
  collection: Collection;
  tourId: string | null;
  variant: 'A' | 'B';
  isHome: boolean;
}

const pathFor = (season: Season, collection: Collection) =>
  `${BASE}${season.slug}/${collection.slug}/`;

function currentSeason(today: string, seasons: Season[]): Season {
  const availableSeasons = seasons.filter((season) => season.collections.length > 0);
  const afterWorkSeasons = availableSeasons
    .map((season) => ({
      season,
      collection: season.collections.find((collection) => collection.slug === 'after-work'),
      dates: season.collections
        .find((collection) => collection.slug === 'after-work')
        ?.tours.map((tour) => tour.id)
        .sort(),
    }))
    .filter(
      (
        entry,
      ): entry is { season: Season; collection: Collection; dates: string[] } =>
        entry.collection != null && entry.dates != null && entry.dates.length > 0,
    )
    .sort((a, b) => a.dates[0].localeCompare(b.dates[0]));

  return (
    afterWorkSeasons.find((entry) => entry.dates[0] <= today && today <= entry.dates.at(-1)!)?.season ??
    afterWorkSeasons.find((entry) => entry.dates[0] > today)?.season ??
    afterWorkSeasons.at(-1)?.season ??
    (availableSeasons.at(-1) as Season)
  );
}

/** Saison/Kollektion stecken im Pfad (<base>s27/after-work/), die Tour in ?tour=YYYY-MM-DD. */
function readLocation(seasons: Season[]): Location {
  const isHome = window.location.pathname === BASE;
  const [seasonSlug, collectionSlug] = window.location.pathname.slice(BASE.length).split('/');
  const requestedSeason = seasons.find((s) => s.slug === seasonSlug);
  const season =
    requestedSeason?.collections.length
      ? requestedSeason
      : currentSeason(todayIso(), seasons.filter((entry) => entry.collections.length > 0));
  const defaultCollection =
    season.collections.find((collection) => collection.slug === 'after-work') ?? season.collections[0];
  const collection =
    season.collections.find((c) => c.slug === collectionSlug) ?? defaultCollection;
  return {
    season,
    collection,
    tourId: new URLSearchParams(window.location.search).get('tour'),
    variant: new URLSearchParams(window.location.search).get('variant') === 'B' ? 'B' : 'A',
    isHome,
  };
}

function useLocation(seasons: Season[]) {
  const [loc, setLoc] = useState(() => readLocation(seasons));

  useEffect(() => {
    // Die Startseite bleibt für Homescreen-Verknüpfungen unter der Basis-URL.
    if (loc.isHome) return;

    // Nicht (mehr) gültige Pfade auf die aufgelöste Saison/Kollektion normalisieren.
    const expected = pathFor(loc.season, loc.collection);
    if (window.location.pathname !== expected) {
      const url = new URL(window.location.href);
      url.pathname = expected;
      window.history.replaceState(null, '', url);
    }
  }, [loc.season, loc.collection, loc.isHome]);

  useEffect(() => {
    const onPop = () => setLoc(readLocation(seasons));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [seasons]);

  const go = useCallback(
    (season: Season, collection: Collection, tourId: string | null, variant: 'A' | 'B' = 'A') => {
    const url = new URL(window.location.href);
    url.pathname = pathFor(season, collection);
    url.search = '';
    if (tourId) url.searchParams.set('tour', tourId);
    if (tourId && variant === 'B') url.searchParams.set('variant', variant);
    window.history.pushState(null, '', url);
      setLoc({ season, collection, tourId, variant, isHome: false });
    },
    [],
  );

  return [loc, go] as const;
}

const next = <T,>(items: T[], current: T) => items[(items.indexOf(current) + 1) % items.length];

function isWithinNextSevenDays(date: string, today: string): boolean {
  const toUtcDay = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const daysUntil = (toUtcDay(date) - toUtcDay(today)) / 86_400_000;
  return daysUntil >= 0 && daysUntil <= 7;
}

export default function App() {
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const community = useCommunityAuth();
  const [loadedRoadbookKey, setLoadedRoadbookKey] = useState<string | null>(null);
  const isAdmin = community.session?.user.app_metadata.role === 'admin';
  const [managedCollections, setManagedCollections] = useState<{ season_slug: string; collection_slug: string }[]>([]);
  const [organizersLoading, setOrganizersLoading] = useState(false);
  const [organizersError, setOrganizersError] = useState<string | null>(null);
  const loggedIn =
    isAdmin ||
    (community.member?.status === 'approved' && Boolean(community.member.email_confirmed_at));
  const authReady = community.authReady;
  const approvedUserId =
    community.member?.status === 'approved' && community.member.email_confirmed_at
      ? community.session?.user.id ?? null
      : null;
  const organizerUserId = isAdmin ? community.session?.user.id ?? null : approvedUserId;
  const roadbookLoadKey = `${loggedIn}-${reloadVersion}`;

  useEffect(() => {
    if (!community.session) return;

    const returnTo = sessionStorage.getItem(COMMUNITY_AUTH_RETURN_TO_KEY);
    const savedAt = Number(sessionStorage.getItem(COMMUNITY_AUTH_RETURN_TO_SAVED_AT_KEY));
    sessionStorage.removeItem(COMMUNITY_AUTH_RETURN_TO_KEY);
    sessionStorage.removeItem(COMMUNITY_AUTH_RETURN_TO_SAVED_AT_KEY);
    if (
      !returnTo?.startsWith('/') ||
      returnTo.startsWith('//') ||
      !Number.isFinite(savedAt) ||
      savedAt > Date.now() ||
      Date.now() - savedAt > 10 * 60 * 1000
    ) return;

    const target = new URL(returnTo, window.location.origin);
    if (target.origin !== window.location.origin) return;
    const targetPath = `${target.pathname}${target.search}${target.hash}`;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (targetPath === currentPath) return;

    window.history.replaceState(null, '', targetPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [community.session]);

  useEffect(() => {
    let active = true;
    if (!authReady) return;
    if (!supabase || !organizerUserId) {
      setManagedCollections([]);
      setOrganizersError(null);
      setOrganizersLoading(false);
      return;
    }

    setOrganizersLoading(true);
    setOrganizersError(null);
    void (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('collection_organizers')
          .select('season_slug, collection_slug')
          .eq('user_id', organizerUserId);
        if (!active) return;
        if (queryError) setOrganizersError(queryError.message);
        else setManagedCollections(data ?? []);
      } catch (cause) {
        if (active) {
          setOrganizersError(cause instanceof Error ? cause.message : 'Kollektion-Berechtigungen konnten nicht geladen werden.');
        }
      } finally {
        if (active) setOrganizersLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authReady, organizerUserId]);

  useEffect(() => {
    let active = true;
    if (!supabase) {
      setError('Die Verbindung zur Roadbook-Datenbank ist noch nicht eingerichtet.');
      return () => {
        active = false;
      };
    }
    if (!authReady) {
      return () => {
        active = false;
      };
    }

    // Die Datenbank liefert je nach Freigabe andere Kollektionen aus, daher bei Statuswechsel neu laden.
    setLoadProgress(0);
    fetchRoadbook((fraction) => {
      if (active) setLoadProgress(fraction);
    })
      .then((data) => {
        if (active) {
          setSeasons(data);
          setLoadedRoadbookKey(roadbookLoadKey);
          setDataVersion((version) => version + 1);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Die Tourendaten konnten nicht geladen werden.');
        }
      });

    return () => {
      active = false;
    };
  }, [authReady, loggedIn, reloadVersion, roadbookLoadKey]);

  if (error) {
    return (
      <main className="backend-state" role="alert">
        <h1>Roadbook nicht erreichbar</h1>
        <p>{error}</p>
        <p>Bitte prüfe die Supabase-Konfiguration und die Datenbankverbindung.</p>
      </main>
    );
  }
  if (organizersError) {
    return (
      <main className="backend-state" role="alert">
        <h1>Berechtigungen nicht verfügbar</h1>
        <p>Die Kollektion-Berechtigungen konnten nicht geladen werden: {organizersError}</p>
        <p>Bitte prüfe, ob die Supabase-Migration 202611140001_collection_organizers.sql angewendet wurde.</p>
      </main>
    );
  }
  if (organizersLoading) return <LoadingScreen progress={0.5} />;
  if (!seasons || !authReady || loadedRoadbookKey !== roadbookLoadKey) {
    return <LoadingScreen progress={authReady ? 0.15 + 0.85 * loadProgress : 0.05} />;
  }
  if (seasons.length === 0) {
    return <main className="backend-state">Es sind noch keine Saisons angelegt.</main>;
  }
  if (!seasons.some((season) => season.collections.length > 0)) {
    return <main className="backend-state">Es sind noch keine Kollektionen angelegt.</main>;
  }

  return (
    <RoadbookGate
      seasons={seasons}
      dataVersion={dataVersion}
      onReload={() => setReloadVersion((version) => version + 1)}
      community={community}
      loggedIn={loggedIn}
      isAdmin={isAdmin}
      managedCollections={managedCollections}
    />
  );
}

const PUBLIC_COLLECTION = 'after-work';

function hasRequestedPrivateCollection(seasons: Season[]): boolean {
  const [seasonSlug, collectionSlug] = window.location.pathname.slice(BASE.length).split('/');
  return Boolean(
    seasonSlug &&
      collectionSlug &&
      collectionSlug !== PUBLIC_COLLECTION &&
      seasons.some((season) => season.slug === seasonSlug),
  );
}

function RoadbookGate({
  seasons,
  dataVersion,
  community,
  loggedIn,
  isAdmin,
  managedCollections,
  onReload,
}: {
  seasons: Season[];
  dataVersion: number;
  community: ReturnType<typeof useCommunityAuth>;
  loggedIn: boolean;
  isAdmin: boolean;
  managedCollections: { season_slug: string; collection_slug: string }[];
  onReload: () => void;
}) {
  const visibleSeasons = useMemo(
    () =>
      loggedIn
        ? seasons
        : seasons.map((season) => ({
            ...season,
            collections: season.collections.filter(
              (collection) => collection.slug === PUBLIC_COLLECTION,
            ),
          })),
    [loggedIn, seasons],
  );

  if (!loggedIn && hasRequestedPrivateCollection(seasons)) {
    return (
      <main className="backend-state access-required">
        <h1>Tour nur für Mitglieder</h1>
        <p>
          Diese Tour ist nur mit einem freigeschalteten Community-Konto sichtbar. Bitte melde dich
          an oder registriere dich, um sie anzusehen.
        </p>
        <CommunityAccount
          email={community.session?.user.email ?? null}
          member={community.member}
          isAdmin={isAdmin}
          loading={community.loading}
          error={community.error}
          onRefresh={community.refresh}
          accessRequired
        />
      </main>
    );
  }

  if (!visibleSeasons.some((season) => season.collections.length > 0)) {
    return <main className="backend-state">Es sind noch keine Touren veröffentlicht.</main>;
  }

  // key: Ort aus der URL neu auflösen, wenn neue Daten geladen wurden (z. B. nach Login/Freigabe)
  return (
    <Roadbook
      key={`${loggedIn}-${dataVersion}`}
      seasons={visibleSeasons}
      community={community}
      loggedIn={loggedIn}
      isAdmin={isAdmin}
      managedCollections={managedCollections}
      onReload={onReload}
    />
  );
}

function Roadbook({
  seasons,
  community,
  loggedIn,
  isAdmin,
  managedCollections,
  onReload,
}: {
  seasons: Season[];
  community: ReturnType<typeof useCommunityAuth>;
  loggedIn: boolean;
  isAdmin: boolean;
  managedCollections: { season_slug: string; collection_slug: string }[];
  onReload: () => void;
}) {
  const today = todayIso(new Date());
  const availableSeasons = useMemo(
    () => seasons.filter((entry) => entry.collections.length > 0),
    [seasons],
  );
  const [{ season, collection, tourId, variant }, go] = useLocation(availableSeasons);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [routeSelection, setRouteSelection] = useState({ key: '', index: 0 });
  const [editor, setEditor] = useState<
    { mode: 'create' } | { mode: 'edit'; tour: Tour } | null
  >(null);
  const [collectionTourEditor, setCollectionTourEditor] = useState<Tour | null | undefined>(undefined);
  const [collectionTourError, setCollectionTourError] = useState<string | null>(null);
  const memberId =
    community.member?.status === 'approved' && community.member.email_confirmed_at
      ? community.session?.user.id ?? null
      : null;
  const editorMemberId = memberId ?? (isAdmin ? community.session?.user.id ?? null : null);
  const isCollectionOrganizer = Boolean(
    (memberId || isAdmin) && managedCollections.some(
      (entry) => entry.season_slug === season.slug && entry.collection_slug === collection.slug,
    ),
  );

  useEffect(() => {
    document.documentElement.style.setProperty('--collection-color', collection.color);
  }, [collection.color]);

  const sorted = useMemo(
    () =>
      [...collection.tours].sort(
        (a, b) =>
          a.id.slice(0, 10).localeCompare(b.id.slice(0, 10)) ||
          (a.meetingTime ?? '').localeCompare(b.meetingTime ?? '') ||
          a.id.localeCompare(b.id),
      ),
    [collection],
  );
  const selected =
    sorted.find((t) => t.id === tourId) ?? sorted.find((t) => tourEndDate(t) >= today) ?? sorted.at(-1);
  const selectionKey = `${season.slug}/${collection.slug}/${selected?.id ?? ''}`;
  const routeCount = selected ? tourRouteCount(selected) : 1;
  const routeIndex = routeSelection.key === selectionKey
    ? Math.min(routeSelection.index, routeCount - 1)
    : 0;
  const displayedTour: Tour | undefined =
    selected && routeCount > 1
      ? tourRouteAt(selected, routeIndex)
      : selected && variant === 'B' && selected.alternative
      ? { ...selected.alternative, id: selected.id, endDate: selected.endDate }
      : selected;
  const displayedVariant = variant === 'B' && selected?.alternative ? 'B' : 'A';
  const displayedRoute = displayedTour?.routeStats;
  const durationMin =
    displayedTour?.durationMin ??
    (displayedRoute
      ? estimateDurationMin(displayedRoute.distanceKm, displayedRoute.ascentM)
      : null);
  const routeStart = displayedRoute?.geoPath[0];
  const weatherLocation =
    displayedTour &&
    displayedTour.meetingTime &&
    (routeStart || displayedTour.meetingPlace) &&
    isWithinNextSevenDays(displayedTour.id, today)
      ? routeStart
        ? {
            place: displayedTour.stations[0] ?? 'Startpunkt',
            longitude: routeStart[0],
            latitude: routeStart[1],
          }
        : CHEMNITZ_WEATHER_LOCATION
      : undefined;

  const nextCollection = next(season.collections, collection);

  return (
    <div className="page">
      <header className="nav">
        {loggedIn && (
          <CollectionSwitcher
            collections={season.collections}
            current={collection}
            onNext={() => go(season, nextCollection, null)}
          />
        )}
        <h2 className="nav__title">
          <a href={BASE} aria-label="Zur Startseite">
            KLLKTV
          </a>
        </h2>
        <div className="nav__profile">
          <CommunityAccount
            email={community.session?.user.email ?? null}
            member={community.member}
            isAdmin={community.session?.user.app_metadata.role === 'admin'}
            loading={community.loading}
            error={community.error}
            onRefresh={community.refresh}
          />
        </div>
      </header>
      {loggedIn && calendarOpen && (
        <TourCalendar
          seasons={availableSeasons}
          selectedId={selected?.id ?? today}
          selectedSeasonSlug={season.slug}
          selectedCollectionSlug={collection.slug}
          onClose={() => setCalendarOpen(false)}
          onSelect={(targetSeason, targetCollection, id) => {
            setCalendarOpen(false);
            go(targetSeason, targetCollection, id);
          }}
        />
      )}
      {selected ? (
        <main className="tour">
          <TourTimeline
            tours={sorted}
            selectedId={selected.id}
            today={today}
            onSelect={(id) => go(season, collection, id)}
            onToggleAlternative={(id) =>
              go(season, collection, id, displayedVariant === 'A' ? 'B' : 'A')
            }
            startLabel={collection.startLabel}
            endLabel={collection.endLabel}
            onOpenCalendar={loggedIn ? () => setCalendarOpen(true) : undefined}
            onAddEvent={
              memberId && collection.slug === 'events'
                ? () => setEditor({ mode: 'create' })
                : undefined
            }
            onAddTour={
              isCollectionOrganizer && collection.slug !== 'events'
                ? () => {
                    setCollectionTourError(null);
                    setCollectionTourEditor(null);
                  }
                : undefined
            }
          />
          <TourDetails
            tour={displayedTour ?? selected}
            seasonSlug={season.slug}
            collectionSlug={collection.slug}
            memberId={memberId}
            isAdmin={isAdmin}
            isCollectionOrganizer={isCollectionOrganizer}
            member={community.member}
            position={sorted.indexOf(selected) + 1}
            count={sorted.length}
            isPast={tourEndDate(selected) < today}
            route={displayedRoute}
            durationMin={durationMin}
            weatherLocation={weatherLocation}
            variant={displayedVariant}
            onVariantChange={
              selected.alternative
                ? (nextVariant) => go(season, collection, selected.id, nextVariant)
                : undefined
            }
            onEditEvent={() => {
              if (isCollectionOrganizer && collection.slug !== 'events') {
                setCollectionTourError(null);
                setCollectionTourEditor(selected);
              } else {
                setEditor({ mode: 'edit', tour: selected });
              }
            }}
            onDeleteTour={isCollectionOrganizer ? () => {
              if (!window.confirm(`„${selected.title}“ wirklich löschen?`)) return;
              void deleteTour(selected, {
                cleanupRoutesBeforeDelete: collection.slug === 'events',
              }).then(() => {
                go(season, collection, null);
                onReload();
              }).catch((cause: unknown) => {
                window.alert(cause instanceof Error ? cause.message : 'Die Tour konnte nicht gelöscht werden.');
              });
            } : undefined}
            routeRefreshKey={selected}
            routeIndex={routeIndex}
            routeCount={routeCount}
            onRouteChange={(index) => setRouteSelection({ key: selectionKey, index })}
          />
        </main>
      ) : (
        <main className="empty">
          Noch keine Touren eingetragen.
          {memberId && collection.slug === 'events' && (
            <button
              type="button"
              className="timeline__add"
              onClick={() => setEditor({ mode: 'create' })}
              aria-label="Event anlegen"
            >
              +
            </button>
          )}
          {isCollectionOrganizer && collection.slug !== 'events' && (
            <button
              type="button"
              className="timeline__add"
              onClick={() => {
                setCollectionTourError(null);
                setCollectionTourEditor(null);
              }}
              aria-label="Tour anlegen"
            >
              +
            </button>
          )}
        </main>
      )}
      {editor && editorMemberId && (
        <EventEditor
          seasonSlug={season.slug}
          collectionSlug={collection.slug}
          memberId={editorMemberId}
          isCollectionOrganizer={isCollectionOrganizer}
          tour={editor.mode === 'edit' ? editor.tour : undefined}
          onClose={() => setEditor(null)}
          onSaved={(id) => {
            setEditor(null);
            go(season, collection, id);
            onReload();
          }}
          onDeleted={() => {
            setEditor(null);
            go(season, collection, null);
            onReload();
          }}
        />
      )}
      {collectionTourEditor !== undefined && createPortal(
        <div className="community__overlay" role="dialog" aria-modal="true" aria-labelledby="collection-tour-editor-title">
          <button
            className="community__backdrop"
            type="button"
            aria-label="Schließen"
            onClick={() => setCollectionTourEditor(undefined)}
          />
          <section className="community__panel community__panel--collection-tour">
            <header className="community__header">
              <h2 id="collection-tour-editor-title">{collectionTourEditor ? 'Tour bearbeiten' : 'Tour anlegen'}</h2>
            </header>
            <div className="community__content">
              {collectionTourError && <p className="community__message community__message--error" role="alert">{collectionTourError}</p>}
              <Suspense fallback={<p role="status">Tour-Editor wird geladen …</p>}>
                <CollectionTourEditor
                  season={season}
                  collection={collection}
                  tour={collectionTourEditor}
                  onCancel={() => setCollectionTourEditor(undefined)}
                  onSaved={async () => {
                    setCollectionTourEditor(undefined);
                    onReload();
                  }}
                  onError={(cause: unknown) => {
                    setCollectionTourError(cause instanceof Error ? cause.message : 'Die Tour konnte nicht gespeichert werden.');
                  }}
                />
              </Suspense>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
