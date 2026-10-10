import type { RouteStats } from '../../domain/route';

const W = 320;
const H = 250;
const PAD = 32;

const arrowIndexes = (coords: number[][]) => {
  if (coords.length < 5) return [];

  const straightIndexes = coords
    .map((_, index) => index)
    .filter((index) => index >= 2 && index < coords.length - 2)
    .filter((index) => {
      const before = coords[index - 2];
      const current = coords[index];
      const after = coords[index + 2];
      const incomingX = current[0] - before[0];
      const incomingY = current[1] - before[1];
      const outgoingX = after[0] - current[0];
      const outgoingY = after[1] - current[1];
      const incomingLength = Math.hypot(incomingX, incomingY);
      const outgoingLength = Math.hypot(outgoingX, outgoingY);
      if (incomingLength === 0 || outgoingLength === 0) return false;

      const cosine =
        (incomingX * outgoingX + incomingY * outgoingY) /
        (incomingLength * outgoingLength);
      return Math.acos(Math.max(-1, Math.min(1, cosine))) <= Math.PI / 24;
    });

  const arrowCount = Math.min(6, Math.max(2, Math.floor(coords.length / 20)));
  const selectedCount = Math.min(arrowCount, straightIndexes.length);
  return Array.from({ length: selectedCount }, (_, index) =>
    straightIndexes[Math.round(((index + 1) * (straightIndexes.length - 1)) / (selectedCount + 1))],
  );
};

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
  const arrows = arrowIndexes(coords).map((index) => {
    const previous = coords[index - 1];
    const current = coords[index];
    const next = coords[index + 1];
    const dx = next[0] - previous[0];
    const dy = next[1] - previous[1];
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const px = -uy;
    const py = ux;
    const tipLength = 5;
    const baseWidth = 4.5;
    const tip = [current[0] + ux * tipLength, current[1] + uy * tipLength];
    const left = [
      current[0] - ux * tipLength + px * baseWidth,
      current[1] - uy * tipLength + py * baseWidth,
    ];
    const right = [
      current[0] - ux * tipLength - px * baseWidth,
      current[1] - uy * tipLength - py * baseWidth,
    ];
    return `${tip.join(',')} ${left.join(',')} ${right.join(',')}`;
  });

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
            {arrows.map((points, index) => (
              <polygon key={index} points={points} fill="var(--accent)" />
            ))}
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
