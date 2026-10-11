import type { PointerEvent } from 'react';
import type { RouteStats } from '../../domain/route';
import { formatNumber } from '../../shared/format/number';

const W = 320;
const H = 116;
const LEFT = 30;
const TOP = 7;
const CHART_H = 77;

interface Props {
  route: RouteStats;
  activeDistanceKm: number | null;
  onHoverDistance: (distanceKm: number | null) => void;
}

export function ElevationProfile({ route, activeDistanceKm, onHoverDistance }: Props) {
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
  const activeX = activeDistanceKm === null ? null : x(activeDistanceKm);
  let activeElevation: number | null = null;
  let activeY: number | null = null;
  if (activeDistanceKm !== null) {
    const nextIndex = profile.findIndex(([km]) => km >= activeDistanceKm);
    const rightIndex = nextIndex < 0 ? profile.length - 1 : nextIndex;
    const leftIndex = Math.max(0, rightIndex - 1);
    const [leftKm, leftElevation] = profile[leftIndex];
    const [rightKm, rightElevation] = profile[rightIndex];
    const progress = rightKm === leftKm ? 0 : (activeDistanceKm - leftKm) / (rightKm - leftKm);
    activeElevation = leftElevation + (rightElevation - leftElevation) * progress;
    activeY = y(activeElevation);
  }
  const activeLabelY =
    activeY === null ? null : Math.max(TOP + 10, Math.min(TOP + CHART_H, activeY - 4));

  const handlePointerMove = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!bounds) return;

    const svgX = ((event.clientX - bounds.left) / bounds.width) * W;
    const activeDistance = Math.max(0, Math.min(distanceKm, ((svgX - LEFT) / chartW) * distanceKm));
    onHoverDistance(activeDistance);
  };

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
        {activeX !== null && (
          <>
            <line
              x1={activeX}
              x2={activeX}
              y1={TOP}
              y2={TOP + CHART_H}
              stroke="var(--accent)"
              strokeDasharray="3 3"
            />
            {activeY !== null && <circle cx={activeX} cy={activeY} r={3} fill="var(--accent)" />}
            {activeY !== null && activeElevation !== null && (
              <g className="profile__active-elevation">
                <rect x={0} y={(activeLabelY ?? activeY) - 9} width={28} height={13} rx={3} />
                <text
                  x={14}
                  y={activeLabelY ?? activeY}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                >
                  {Math.round(activeElevation)}
                </text>
              </g>
            )}
          </>
        )}
        <g fontSize={10} fill="var(--muted)">
          <text x={LEFT} y={H - 3}>0</text>
          <text x={LEFT + chartW / 2} y={H - 3} textAnchor="middle">
            {formatNumber(distanceKm / 2)}
          </text>
          <text x={W} y={H - 3} textAnchor="end">
            {formatNumber(distanceKm)} km
          </text>
        </g>
        <rect
          className="profile__interaction"
          x={LEFT}
          y={TOP}
          width={chartW}
          height={CHART_H}
          fill="transparent"
          pointerEvents="all"
          onPointerDown={handlePointerMove}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => onHoverDistance(null)}
        />
      </svg>
    </section>
  );
}
