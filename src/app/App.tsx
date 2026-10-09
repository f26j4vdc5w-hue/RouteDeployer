import { useCallback, useEffect, useMemo, useState } from 'react';
import { routes } from '../data/routes';
import { tours } from '../data/seasons/2027/after-work/tours';
import { TourDetails } from '../features/tour-details/TourDetails';
import { TourTimeline } from '../features/tour-timeline/TourTimeline';
import { todayIso, yearOf } from '../shared/format/date';

const sorted = [...tours].sort((a, b) => a.id.localeCompare(b.id));

const readTourId = () => new URLSearchParams(window.location.search).get('tour');

/** Gewählte Tour steckt im URL-Parameter ?tour=YYYY-MM-DD, damit sie verlinkbar ist. */
function useSelectedTourId(fallback: string) {
  const [id, setId] = useState(() => {
    const fromUrl = readTourId();
    return sorted.some((t) => t.id === fromUrl) ? (fromUrl as string) : fallback;
  });

  useEffect(() => {
    const onPop = () => {
      const fromUrl = readTourId();
      setId(sorted.some((t) => t.id === fromUrl) ? (fromUrl as string) : fallback);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [fallback]);

  const select = useCallback((next: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tour', next);
    window.history.pushState(null, '', url);
    setId(next);
  }, []);

  return [id, select] as const;
}

export default function App() {
  const now = new Date();
  const today = todayIso(now);
  const defaultId = useMemo(
    () => (sorted.find((t) => t.id >= today) ?? sorted.at(-1))?.id ?? '',
    [today],
  );
  const [selectedId, select] = useSelectedTourId(defaultId);

  const selected = sorted.find((t) => t.id === selectedId);
  if (!selected) {
    return <main className="page empty">Noch keine Touren eingetragen.</main>;
  }

  const year = yearOf(selected.id);
  const season = sorted.filter((t) => yearOf(t.id) === year);
  const index = season.findIndex((t) => t.id === selected.id);

  return (
    <div className="page">
      <header className="nav">
        <h2 className="nav__title">KLLKTV</h2>
      </header>
      <main className="tour">
        <TourTimeline tours={season} selectedId={selected.id} today={today} onSelect={select} />
        <TourDetails
          tour={selected}
          position={index + 1}
          count={season.length}
          isPast={selected.id < today}
          route={routes[selected.gpx]}
        />
      </main>
    </div>
  );
}
