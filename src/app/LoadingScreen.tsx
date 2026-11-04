import './loading-screen.css';

interface Props {
  /** Fortschritt zwischen 0 und 1. */
  progress: number;
}

function RoadBike() {
  return (
    <svg viewBox="0 0 64 40" width="56" height="35" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className="loading__wheel" style={{ transformOrigin: '12px 28px' }}>
        <circle cx="12" cy="28" r="9" />
        <path d="M12 19v18M3 28h18" strokeWidth="1" />
      </g>
      <g className="loading__wheel" style={{ transformOrigin: '52px 28px' }}>
        <circle cx="52" cy="28" r="9" />
        <path d="M52 19v18M43 28h18" strokeWidth="1" />
      </g>
      <path d="M12 28h19l-6-14h20L31 28M12 28l13-14M45 14l7 14M22 11h6M25 14v-3M45 14l-1-5h4" />
      <circle cx="31" cy="28" r="1.6" fill="currentColor" />
    </svg>
  );
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
          <RoadBike />
        </div>
      </div>
      <p>Roadbook wird geladen …</p>
    </main>
  );
}
