import { useCallback, useEffect, useMemo, useState } from 'react';
import { defaultSeason, seasons, type Collection, type Season } from '../data/catalog';
import { routes } from '../data/routes';
import { TourDetails } from '../features/tour-details/TourDetails';
import { TourTimeline } from '../features/tour-timeline/TourTimeline';
import { todayIso } from '../shared/format/date';

const BASE = import.meta.env.BASE_URL;

interface Location {
  season: Season;
  collection: Collection;
  tourId: string | null;
}

const pathFor = (season: Season, collection: Collection) =>
  `${BASE}${season.slug}/${collection.slug}/`;

/** Saison/Kollektion stecken im Pfad (<base>s27/after-work/), die Tour in ?tour=YYYY-MM-DD. */
function readLocation(): Location {
  const [seasonSlug, collectionSlug] = window.location.pathname.slice(BASE.length).split('/');
  const season = seasons.find((s) => s.slug === seasonSlug) ?? defaultSeason;
  const collection =
    season.collections.find((c) => c.slug === collectionSlug) ?? season.collections[0];
  return { season, collection, tourId: new URLSearchParams(window.location.search).get('tour') };
}

function useLocation() {
  const [loc, setLoc] = useState(readLocation);

  useEffect(() => {
    // Nicht (mehr) gültige Pfade auf die aufgelöste Saison/Kollektion normalisieren.
    const expected = pathFor(loc.season, loc.collection);
    if (window.location.pathname !== expected) {
      const url = new URL(window.location.href);
      url.pathname = expected;
      window.history.replaceState(null, '', url);
    }
  }, [loc.season, loc.collection]);

  useEffect(() => {
    const onPop = () => setLoc(readLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((season: Season, collection: Collection, tourId: string | null) => {
    const url = new URL(window.location.href);
    url.pathname = pathFor(season, collection);
    url.search = '';
    if (tourId) url.searchParams.set('tour', tourId);
    window.history.pushState(null, '', url);
    setLoc({ season, collection, tourId });
  }, []);

  return [loc, go] as const;
}

const next = <T,>(items: T[], current: T) => items[(items.indexOf(current) + 1) % items.length];

export default function App() {
  const today = todayIso(new Date());
  const [{ season, collection, tourId }, go] = useLocation();

  useEffect(() => {
    document.documentElement.dataset.collection = collection.slug;
  }, [collection.slug]);

  const sorted = useMemo(
    () => [...collection.tours].sort((a, b) => a.id.localeCompare(b.id)),
    [collection],
  );
  const selected =
    sorted.find((t) => t.id === tourId) ?? sorted.find((t) => t.id >= today) ?? sorted.at(-1);

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
        <h2 className="nav__title">KLLKTV</h2>
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
            startLabel={collection.startLabel}
            endLabel={collection.endLabel}
          />
          <TourDetails
            tour={selected}
            position={sorted.indexOf(selected) + 1}
            count={sorted.length}
            isPast={selected.id < today}
            route={selected.gpx ? routes[selected.gpx] : undefined}
          />
        </main>
      ) : (
        <main className="empty">Noch keine Touren eingetragen.</main>
      )}
    </div>
  );
}
