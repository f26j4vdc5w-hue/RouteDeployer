import type { RouteStats } from '../../domain/route';
import { formatNumber } from '../../shared/format/number';

const W = 320;
const H = 116;
const LEFT = 30;
const TOP = 7;
const CHART_H = 77;

export function ElevationProfile({ route }: { route: RouteStats }) {
  const { profile, distanceKm } = route;
  if (profile.length < 2) return null;

  const maxEle = Math.max(...profile.map((p) => p[1]));
  const niceMax = Math.max(100, Math.ceil(maxEle / 100) * 100);
  const chartW = W - LEFT;
  const x = (km: number) => LEFT + (km / distanceKm) * chartW;
  const y = (ele: number) => TOP + CHART_H - (Math.max(ele, 0) / niceMax) * CHART_H;

  const line = profile.map(([km, ele]) => `${x(km).toFixed(1)},${y(ele).toFixed(1)}`);
  const area = `M${x(0)},${TOP + CHART_H} L${line.join(' L')} L${x(distanceKm)},${TOP + CHART_H} Z`;
  const ticks = [niceMax, niceMax / 2, 0];

  return (
    <section className="profile">
      <div className="profile__head">
        <h2>Höhenprofil</h2>
        <span>Höhe in m</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Höhenprofil der Tour">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={LEFT} x2={W} y1={y(t)} y2={y(t)} stroke="var(--border)" />
            <text x={0} y={y(t) + 3} fontSize={9} fill="var(--muted)">
              {t}
            </text>
          </g>
        ))}
        <path d={area} fill="var(--accent)" opacity={0.15} />
        <polyline
          points={line.join(' ')}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <g fontSize={10} fill="var(--muted)">
          <text x={LEFT} y={H - 3}>0</text>
          <text x={LEFT + chartW / 2} y={H - 3} textAnchor="middle">
            {formatNumber(distanceKm / 2)}
          </text>
          <text x={W} y={H - 3} textAnchor="end">
            {formatNumber(distanceKm)} km
          </text>
        </g>
      </svg>
    </section>
  );
}
