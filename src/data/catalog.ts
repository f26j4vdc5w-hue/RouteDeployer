import type { Season } from '../domain/catalog';
export type { Collection, Season } from '../domain/catalog';
import { tours as afterWork2026 } from './seasons/2026/after-work/tours';
import { tours as camp2026 } from './seasons/2026/camp/tours';
import { tours as afterWork2027 } from './seasons/2027/after-work/tours';

const SEASON_LABELS = { startLabel: 'SAISONBEGINN', endLabel: 'SAISONENDE' };
const CAMP_LABELS = { startLabel: 'ANREISE', endLabel: 'ABREISE' };

/** Statischer Ausgangsbestand für den einmaligen Supabase-Import. */
export const seasons: Season[] = [
  {
    slug: 's26',
    label: 'S26',
    collections: [
      { slug: 'camp', label: 'Camp', color: '#ff4d57', tours: camp2026, ...CAMP_LABELS },
      { slug: 'after-work', label: 'After Work', color: '#a45cff', tours: afterWork2026, ...SEASON_LABELS },
    ],
  },
  {
    slug: 's27',
    label: 'S27',
    collections: [
      { slug: 'after-work', label: 'After Work', color: '#a45cff', tours: afterWork2027, ...SEASON_LABELS },
    ],
  },
];

export const defaultSeason = seasons.at(-1) as Season;
