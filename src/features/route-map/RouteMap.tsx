import type { RouteStats } from '../../domain/route';

const W = 320;
const H = 250;
const PAD = 32;
const TILE_SIZE = 256;
const MAX_ZOOM = 17;

const project = (longitude: number, latitude: number, zoom: number) => {
  const scale = 2 ** zoom;
  const x = ((longitude + 180) / 360) * scale * TILE_SIZE;
  const sine = Math.sin((latitude * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale * TILE_SIZE;
  return [x, y] as const;
};

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
  const geoPath = route?.geoPath ?? [];
  const geoWorld = geoPath.map(([longitude, latitude]) => project(longitude, latitude, 0));
  const geoMinX = geoWorld.length ? Math.min(...geoWorld.map(([x]) => x)) : 0;
  const geoMaxX = geoWorld.length ? Math.max(...geoWorld.map(([x]) => x)) : 1;
  const geoMinY = geoWorld.length ? Math.min(...geoWorld.map(([, y]) => y)) : 0;
  const geoMaxY = geoWorld.length ? Math.max(...geoWorld.map(([, y]) => y)) : 1;
  const mapZoom = geoPath.length > 1
    ? Math.max(
        1,
        Math.min(
          MAX_ZOOM,
          Math.log2(
            Math.min(
              (W - 2 * PAD) / (geoMaxX - geoMinX),
              (H - 2 * PAD) / (geoMaxY - geoMinY),
            ),
          ),
        ),
      )
    : 0;
  const tileZoom = Math.ceil(mapZoom);
  const zoomScale = 2 ** (mapZoom - tileZoom);
  const projectedGeo = geoPath.map(([longitude, latitude]) => project(longitude, latitude, tileZoom));
  const centerX =
    projectedGeo.length > 0
      ? (Math.min(...projectedGeo.map(([x]) => x)) + Math.max(...projectedGeo.map(([x]) => x))) / 2
      : 0;
  const centerY =
    projectedGeo.length > 0
      ? (Math.min(...projectedGeo.map(([, y]) => y)) + Math.max(...projectedGeo.map(([, y]) => y))) / 2
      : 0;
  const worldLeft = centerX - W / (2 * zoomScale);
  const worldTop = centerY - H / (2 * zoomScale);
  const coords = projectedGeo.length > 1
    ? projectedGeo.map(([x, y]) => [(x - worldLeft) * zoomScale, (y - worldTop) * zoomScale])
    : (() => {
        const maxX = Math.max(...points.map((p) => p[0]), 0.001);
        const maxY = Math.max(...points.map((p) => p[1]), 0.001);
        const scale = Math.min((W - 2 * PAD) / maxX, (H - 2 * PAD) / maxY);
        const offsetX = (W - maxX * scale) / 2;
        const offsetY = (H - maxY * scale) / 2;
        return points.map(([x, y]) => [offsetX + x * scale, offsetY + y * scale]);
      })();
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
  const tiles = geoPath.length > 1
    ? Array.from(
        {
          length:
            Math.ceil((worldLeft + W / zoomScale) / TILE_SIZE) - Math.floor(worldLeft / TILE_SIZE),
        },
        (_, column) => {
          const x = Math.floor(worldLeft / TILE_SIZE) + column;
          return Array.from(
            {
              length:
                Math.ceil((worldTop + H / zoomScale) / TILE_SIZE) - Math.floor(worldTop / TILE_SIZE),
            },
            (_, row) => {
              const y = Math.floor(worldTop / TILE_SIZE) + row;
              const tileCount = 2 ** tileZoom;
              const wrappedX = ((x % tileCount) + tileCount) % tileCount;
              return {
                key: `${wrappedX}-${y}`,
                href: `https://tile.openstreetmap.org/${tileZoom}/${wrappedX}/${y}.png`,
                x: (x * TILE_SIZE - worldLeft) * zoomScale,
                y: (y * TILE_SIZE - worldTop) * zoomScale,
              };
            },
          );
        },
      ).flat()
    : [];

  return (
    <div className="map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Karte mit Routenverlauf">
        {tiles.map((tile) => (
          <image
            key={tile.key}
            href={tile.href}
            x={tile.x}
            y={tile.y}
            width={TILE_SIZE * zoomScale}
            height={TILE_SIZE * zoomScale}
            preserveAspectRatio="none"
          />
        ))}
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
        <span>{geoPath.length > 1 ? '© OpenStreetMap-Mitwirkende' : 'Illustrative Karte'}</span>
      </div>
    </div>
  );
}
