import { useCallback, useEffect, useMemo, useState } from 'react';
import { defaultSeason, seasons, type Collection, type Season } from '../data/catalog';
import type { Tour } from '../domain/tour';
import { routes } from '../data/routes';
import { TourDetails } from '../features/tour-details/TourDetails';
import { TourTimeline } from '../features/tour-timeline/TourTimeline';
import { todayIso } from '../shared/format/date';
import { estimateDurationMin } from '../shared/format/number';

const BASE = import.meta.env.BASE_URL;
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

function currentSeason(today: string): Season {
  const afterWorkSeasons = seasons
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
    defaultSeason
  );
}

/** Saison/Kollektion stecken im Pfad (<base>s27/after-work/), die Tour in ?tour=YYYY-MM-DD. */
function readLocation(): Location {
  const isHome = window.location.pathname === BASE;
  const [seasonSlug, collectionSlug] = window.location.pathname.slice(BASE.length).split('/');
  const season = seasons.find((s) => s.slug === seasonSlug) ?? currentSeason(todayIso());
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

function useLocation() {
  const [loc, setLoc] = useState(readLocation);

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
    const onPop = () => setLoc(readLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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
  const today = todayIso(new Date());
  const [{ season, collection, tourId, variant }, go] = useLocation();

  useEffect(() => {
    document.documentElement.dataset.collection = collection.slug;
  }, [collection.slug]);

  const sorted = useMemo(
    () => [...collection.tours].sort((a, b) => a.id.localeCompare(b.id)),
    [collection],
  );
  const selected =
    sorted.find((t) => t.id === tourId) ?? sorted.find((t) => t.id >= today) ?? sorted.at(-1);
  const displayedTour: Tour | undefined =
    selected && variant === 'B' && selected.alternative
      ? { ...selected.alternative, id: selected.id }
      : selected;
  const displayedVariant = variant === 'B' && selected?.alternative ? 'B' : 'A';
  const displayedRoute = displayedTour?.gpx ? routes[displayedTour.gpx] : undefined;
  const durationMin =
    displayedTour?.durationMin ??
    (displayedRoute
      ? estimateDurationMin(displayedRoute.distanceKm, displayedRoute.ascentM)
      : null);
  const routeStart = displayedRoute?.geoPath[0];
  const weatherLocation =
    displayedTour && isWithinNextSevenDays(displayedTour.id, today)
      ? routeStart
        ? {
            place: displayedTour.stations[0] ?? 'Startpunkt',
            longitude: routeStart[0],
            latitude: routeStart[1],
          }
        : CHEMNITZ_WEATHER_LOCATION
      : undefined;

  const nextSeason = next(seasons, season);
  const nextCollection = next(season.collections, collection);

  const switchSeason = () => {
    const target =
      nextSeason.collections.find((c) => c.slug === collection.slug) ?? nextSeason.collections[0];
    go(nextSeason, target, null);
  };

  return (
    <div className="page">
      <header className="nav">
        <button
          type="button"
          className="nav__button nav__button--outline"
          onClick={switchSeason}
          disabled={seasons.length < 2}
          aria-label={`Saison wechseln (aktuell ${season.label})`}
        >
          {season.label}
        </button>
        <h2 className="nav__title">
          <a href={BASE} aria-label="Zur Startseite">
            KLLKTV
          </a>
        </h2>
        <button
          type="button"
          className="nav__button nav__button--filled"
          onClick={() => go(season, nextCollection, null)}
          disabled={season.collections.length < 2}
          aria-label={`Kollektion wechseln (aktuell ${collection.label})`}
        >
          {collection.label}
        </button>
      </header>
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
          />
          <TourDetails
            tour={displayedTour ?? selected}
            position={sorted.indexOf(selected) + 1}
            count={sorted.length}
            isPast={selected.id < today}
            route={displayedRoute}
            durationMin={durationMin}
            weatherLocation={weatherLocation}
            variant={displayedVariant}
            onVariantChange={
              selected.alternative
                ? (nextVariant) => go(season, collection, selected.id, nextVariant)
                : undefined
            }
          />
        </main>
      ) : (
        <main className="empty">Noch keine Touren eingetragen.</main>
      )}
    </div>
  );
}
