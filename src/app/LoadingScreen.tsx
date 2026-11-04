import { Bike } from 'lucide-react';
import './loading-screen.css';

interface Props {
  /** Fortschritt zwischen 0 und 1. */
  progress: number;
}

export function LoadingScreen({ progress }: Props) {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <main className="loading" aria-live="polite">
      <div
        className="loading__track"
        role="progressbar"
        aria-label="Roadbook wird geladen"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="loading__bar" style={{ width: `${percent}%` }} />
        <div className="loading__bike" style={{ left: `${percent}%` }}>
          <Bike size={28} aria-hidden="true" />
        </div>
      </div>
      <p>Roadbook wird geladen …</p>
    </main>
  );
}
