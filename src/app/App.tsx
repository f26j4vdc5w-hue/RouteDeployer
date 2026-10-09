import { MousePointer2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { routes } from '../data/routes';
import { tours } from '../data/tours';
import { SeasonPicker } from '../features/season-picker/SeasonPicker';
import { TourDetails } from '../features/tour-details/TourDetails';
import { TourTimeline } from '../features/tour-timeline/TourTimeline';
import { formatToday, todayIso, yearOf } from '../shared/format/date';

const sorted = [...tours].sort((a, b) => a.id.localeCompare(b.id));
const years = [...new Set(sorted.map((t) => yearOf(t.id)))];

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

  const changeYear = (nextYear: number) => {
    const inYear = sorted.filter((t) => yearOf(t.id) === nextYear);
    const target = inYear.find((t) => t.id >= today) ?? inYear.at(-1);
    if (target) select(target.id);
  };

  return (
    <div className="page">
      <header className="nav">
        <h2 className="nav__title">KLLKTV roadbook</h2>
      </header>
      <SeasonPicker
        years={years}
        year={year}
        tours={season}
        selectedId={selected.id}
        onYearChange={changeYear}
        onTourChange={select}
      />
      <main className="tour">
        <TourTimeline tours={season} selectedId={selected.id} today={today} onSelect={select} />
        <TourDetails
          tour={selected}
          position={index + 1}
          count={season.length}
          isPast={selected.id < today}
          route={routes[selected.gpx]}
          prev={season[index - 1]}
          next={season[index + 1]}
          onSelect={select}
        />
      </main>
      <div className="hint">
        <MousePointer2 size={15} />
        <span>Dein Dienstag, deine Tour. Wähle einen Punkt in der Timeline oder ein Datum oben.</span>
      </div>
      <footer className="footer">
        <span>Chemnitz &amp; Umgebung</span>
        <span>Heute: {formatToday(now)}</span>
      </footer>
    </div>
  );
}
