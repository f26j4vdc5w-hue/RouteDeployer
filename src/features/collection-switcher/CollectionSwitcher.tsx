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

// Die Bögen verbinden die Punkte im Uhrzeigersinn, ohne Pfeilspitzen.
function arcPath(fromDeg: number, toDeg: number): string {
  const startDeg = fromDeg + ARROW_GAP_DEG;
  const endDeg = toDeg - ARROW_GAP_DEG;
  const start = pointAt(startDeg);
  const end = pointAt(endDeg);
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${endDeg - startDeg > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
}

export function CollectionSwitcher({ collections, current, onNext }: Props) {
  const count = collections.length;
  const index = Math.max(
    0,
    collections.findIndex((collection) => collection.slug === current.slug),
  );
  const step = 360 / count;

  // Punkte liegen gegen den Uhrzeigersinn, der Ring dreht im Uhrzeigersinn weiter und nie zurück.
  // Die Rotation ergibt sich immer aus Index und voller Umdrehungen, damit sie auch bei Sprüngen
  // oder einer anderen Kollektionsanzahl exakt auf den Punkt der aktiven Kollektion zeigt.
  const state = useRef({ index, turns: 0 });
  if (index < state.current.index) {
    state.current = { index, turns: state.current.turns + 1 };
  } else {
    state.current = { index, turns: state.current.turns };
  }
  const rotation = state.current.turns * 360 + index * step;

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
          style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '20px 20px' }}
        >
          {count > 1 &&
            collections.map((collection, i) => (
              <path
                key={`arrow-${collection.slug}`}
                className="collection-switcher__arc"
                d={arcPath(-(i + 1) * step, -i * step)}
              />
            ))}
          {collections.map((collection, i) => {
            const { x, y } = pointAt(-i * step);
            return (
              <circle
                key={collection.slug}
                className="collection-switcher__dot"
                cx={x}
                cy={y}
                r={DOT_RADIUS}
                style={{ ['--dot-color' as string]: collection.color }}
              />
            );
          })}
        </g>
      </svg>
      <span className="collection-switcher__label">{current.label}</span>
    </button>
  );
}
