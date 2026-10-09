import type { RouteStats } from '../../domain/route';

const W = 320;
const H = 250;
const PAD = 32;

interface Props {
  route?: RouteStats;
}

export function RouteMap({ route }: Props) {
  const points = route?.path ?? [];
  const maxX = Math.max(...points.map((p) => p[0]), 0.001);
  const maxY = Math.max(...points.map((p) => p[1]), 0.001);
  const scale = Math.min((W - 2 * PAD) / maxX, (H - 2 * PAD) / maxY);
  const offsetX = (W - maxX * scale) / 2;
  const offsetY = (H - maxY * scale) / 2;
  const coords = points.map(([x, y]) => [offsetX + x * scale, offsetY + y * scale]);
  const start = coords[0];

  return (
    <div className="map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Illustrative Routenkarte">
        {coords.length > 1 && (
          <>
            <polyline
              points={coords.map((c) => c.join(',')).join(' ')}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={start[0]} cy={start[1]} r={7} fill="#fff" stroke="var(--accent)" strokeWidth={3} />
          </>
        )}
      </svg>
      <div className="map__legend">
        <span className="map__key">
          <i />
          {route?.isLoop ? 'Rundtour · Start = Ziel' : 'Streckentour'}
        </span>
        <span>Illustrative Karte</span>
      </div>
    </div>
  );
}
