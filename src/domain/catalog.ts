import type { Tour } from './tour';

export interface Collection {
  slug: string;
  label: string;
  color: string;
  tours: Tour[];
  startLabel: string;
  endLabel: string;
}

export interface Season {
  slug: string;
  label: string;
  collections: Collection[];
}
