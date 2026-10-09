import type { Tour } from '../domain/tour';
import { tours as afterWork2026 } from './seasons/2026/after-work/tours';
import { tours as camp2026 } from './seasons/2026/camp/tours';
import { tours as afterWork2027 } from './seasons/2027/after-work/tours';

export interface Collection {
  slug: string;
  label: string;
  tours: Tour[];
  /** Beschriftung am Anfang/Ende der Timeline. */
  startLabel: string;
  endLabel: string;
}

export interface Season {
  slug: string;
  label: string;
  collections: Collection[];
}

const SEASON_LABELS = { startLabel: 'SAISONBEGINN', endLabel: 'SAISONENDE' };
const CAMP_LABELS = { startLabel: 'ANREISE', endLabel: 'ABREISE' };

/** Neue Saisons/Kollektionen hier ergänzen (und Pfad in vite.config.ts eintragen). */
export const seasons: Season[] = [
  {
    slug: 's26',
    label: 'S26',
    collections: [
      { slug: 'camp', label: 'Camp', tours: camp2026, ...CAMP_LABELS },
      { slug: 'after-work', label: 'After Work', tours: afterWork2026, ...SEASON_LABELS },
    ],
  },
  {
    slug: 's27',
    label: 'S27',
    collections: [
      { slug: 'after-work', label: 'After Work', tours: afterWork2027, ...SEASON_LABELS },
    ],
  },
];

export const defaultSeason = seasons.at(-1) as Season;
