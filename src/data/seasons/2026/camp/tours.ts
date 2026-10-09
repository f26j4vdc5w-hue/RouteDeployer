import type { Tour } from '../../../../domain/tour';

const MEETING = { meetingTime: '09:30', meetingPlace: 'Camp-Unterkunft' };

// KLLKTV-Camp 2026: 12.–18. April, eine Etappe pro Tag.
export const tours: Tour[] = [
  {
    id: '2026-04-12',
    title: 'Prolog',
    teaser: 'Einrollen zum Auftakt: eine erste Runde, um die Beine zu lockern und die Gegend kennenzulernen.',
    ...MEETING,
    stations: ['Camp-Unterkunft'],
    gpx: '2026/camp/00-prolog.gpx',
  },
  {
    id: '2026-04-13',
    title: 'Puig de la Llorença und Alt de Bernia',
    teaser: 'Tag 1: Zwei Anstiege prägen die erste lange Runde des Camps.',
    ...MEETING,
    stations: ['Puig de la Llorença', 'Alt de Bernia'],
    gpx: '2026/camp/01-puig-de-la-llorenca-alt-de-bernia.gpx',
  },
  {
    id: '2026-04-14',
    title: 'Zitronen-Pass, Xilibre und Tollos',
    teaser: 'Tag 2: Über den Zitronen-Pass ans Meer, am Nachmittag weiter über Xilibre und Tollos.',
    ...MEETING,
    stations: ['Zitronen-Pass', 'Meer', 'Xilibre', 'Tollos'],
    gpx: '2026/camp/02-zitronen-pass-xilibre-tollos.gpx',
  },
  {
    id: '2026-04-15',
    title: 'Montdúver und Vall de la Gallinera',
    teaser: 'Tag 3: Hinauf zum Montdúver und durch das Vall de la Gallinera.',
    ...MEETING,
    stations: ['Montdúver', 'Vall de la Gallinera'],
    gpx: '2026/camp/03-montduver-vall-de-la-gallinera.gpx',
  },
  {
    id: '2026-04-16',
    title: 'Ruhetag am Strand',
    teaser: 'Tag 4: Lockere Ausfahrt an der Costa Blanca, danach Erholung am Strand.',
    ...MEETING,
    stations: ['Costa Blanca'],
    gpx: '2026/camp/04-ruhetag-costa-blanca.gpx',
  },
  {
    id: '2026-04-17',
    title: 'Port de Confrides und Coll de Rates',
    teaser: 'Tag 5: Die Königsetappe mit Port de Confrides und Coll de Rates.',
    ...MEETING,
    stations: ['Port de Confrides', 'Coll de Rates'],
    gpx: '2026/camp/05-port-de-confrides-coll-de-rates.gpx',
  },
  {
    id: '2026-04-18',
    title: 'Coll de Rates, Sa Creueta und Vall d’Ebo',
    teaser: 'Tag 6 (Alternative): Zum Abschluss über Coll de Rates und Sa Creueta ins Vall d’Ebo.',
    ...MEETING,
    stations: ['Coll de Rates', 'Sa Creueta', 'Vall d’Ebo'],
    gpx: '2026/camp/06-coll-de-rates-sa-creueta-vall-d-ebo.gpx',
  },
];
