import { useRef } from 'react';
import type { Collection } from '../../domain/catalog';
import './collection-switcher.css';

interface Props {
  collections: Collection[];
  current: Collection;
  onNext: () => void;
}

const CENTER = 20;
const RADIUS = 14;
const DOT_RADIUS = 4;
const ARROW_GAP_DEG = 24;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const pointAt = (deg: number) => ({
  x: CENTER + RADIUS * Math.cos(toRad(deg)),
  y: CENTER + RADIUS * Math.sin(toRad(deg)),
});

// Der Ring dreht gegen den Uhrzeigersinn, die Pfeile laufen in dieselbe Richtung.
function arrowPath(fromDeg: number, toDeg: number): string {
  const startDeg = fromDeg - ARROW_GAP_DEG;
  const endDeg = toDeg + ARROW_GAP_DEG;
  const start = pointAt(startDeg);
  const end = pointAt(endDeg);
  const tangent = { x: Math.sin(toRad(endDeg)), y: -Math.cos(toRad(endDeg)) };
  const radial = { x: Math.cos(toRad(endDeg)), y: Math.sin(toRad(endDeg)) };
  const base = { x: end.x - tangent.x * 3.5, y: end.y - tangent.y * 3.5 };
  const left = { x: base.x + radial.x * 2.4, y: base.y + radial.y * 2.4 };
  const right = { x: base.x - radial.x * 2.4, y: base.y - radial.y * 2.4 };
  return [
    `M ${start.x} ${start.y}`,
    `A ${RADIUS} ${RADIUS} 0 ${startDeg - endDeg > 180 ? 1 : 0} 0 ${end.x} ${end.y}`,
    `M ${left.x} ${left.y} L ${end.x} ${end.y} L ${right.x} ${right.y}`,
  ].join(' ');
}

export function CollectionSwitcher({ collections, current, onNext }: Props) {
  const count = collections.length;
  const index = Math.max(
    0,
    collections.findIndex((collection) => collection.slug === current.slug),
  );
  const step = 360 / count;

  // Die Drehung läuft immer vorwärts weiter, damit der Kreis nie zurückspult.
  const state = useRef({ index, rotation: -index * step });
  const forward = (index - state.current.index + count) % count;
  if (forward !== 0) {
    state.current = { index, rotation: state.current.rotation - forward * step };
  }

  return (
    <button
      type="button"
      className="collection-switcher"
      onClick={onNext}
      disabled={count < 2}
      aria-label={`Kollektion wechseln (aktuell ${current.label})`}
    >
      <svg className="collection-switcher__ring" viewBox="0 0 40 40" aria-hidden="true">
        <g
          className="collection-switcher__rotor"
          style={{ transform: `rotate(${state.current.rotation}deg)`, transformOrigin: '20px 20px' }}
        >
          {count > 1 &&
            collections.map((collection, i) => (
              <path
                key={`arrow-${collection.slug}`}
                className="collection-switcher__arrow"
                d={arrowPath((i + 1) * step, i * step)}
              />
            ))}
          {collections.map((collection, i) => {
            const { x, y } = pointAt(i * step);
            return (
              <circle
                key={collection.slug}
                className="collection-switcher__dot"
                cx={x}
                cy={y}
                r={DOT_RADIUS}
                fill={collection.color}
              />
            );
          })}
        </g>
      </svg>
      <span className="collection-switcher__label">{current.label}</span>
    </button>
  );
}
