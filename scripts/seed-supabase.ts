import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import { seasons } from '../src/data/catalog';
import type { RouteStats } from '../src/domain/route';
import type { AdditionalRoute, TourRoute } from '../src/domain/tour';

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'VITE_SUPABASE_URL (oder SUPABASE_URL) und SUPABASE_SECRET_KEY (oder SUPABASE_SERVICE_ROLE_KEY) müssen in .env.local oder der Umgebung gesetzt sein.',
  );
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const routes = JSON.parse(
  await readFile(join('src', 'data', 'routes.generated.json'), 'utf8'),
) as Record<string, RouteStats>;

async function findGpxFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return findGpxFiles(path);
      return entry.isFile() && entry.name.toLowerCase().endsWith('.gpx') ? [path] : [];
    }),
  );
  return nested.flat();
}

const bucket = await client.storage.getBucket('routes');
if (bucket.error) {
  throw new Error(`Der GPX-Speicher fehlt. Migration zuerst ausführen: ${bucket.error.message}`);
}

const routeFiles = await findGpxFiles('public/routes');
for (const file of routeFiles) {
  const key = relative('public/routes', file).split(sep).join('/');
  const bytes = await readFile(file);
  const body = new Blob([new Uint8Array(bytes)]);
  const { error } = await client.storage.from('routes').upload(key, body, {
    cacheControl: '3600',
    contentType: 'application/gpx+xml',
    upsert: true,
  });
  if (error) throw new Error(`Upload von ${key} fehlgeschlagen: ${error.message}`);
}
console.log(`[seed] ${routeFiles.length} GPX-Datei(en) übertragen`);

const seasonRows = seasons.map((season, index) => ({
  slug: season.slug,
  label: season.label,
  sort_order: index,
}));
const collectionRows = seasons.flatMap((season) =>
  season.collections.map((collection, index) => ({
    season_slug: season.slug,
    slug: collection.slug,
    label: collection.label,
    color: collection.color,
    start_label: collection.startLabel,
    end_label: collection.endLabel,
    sort_order: index,
  })),
);
const tourRows = seasons.flatMap((season) =>
  season.collections.flatMap((collection) =>
    collection.tours.map((tour) => {
      const routeRecord = (route: TourRoute) => ({
        title: route.title,
        teaser: route.teaser,
        plannedBy: route.plannedBy ?? null,
        meetingTime: route.meetingTime,
        meetingPlace: route.meetingPlace,
        stations: route.stations,
        highlight: route.highlight ?? false,
        durationMin: route.durationMin ?? null,
        gpxKey: route.gpx ?? null,
        routeStats: route.gpx ? routes[route.gpx] ?? null : null,
      });
      const additionalRouteRecords = (tour.additionalRoutes ?? []).map((route: AdditionalRoute) => {
        if (!route.gpx) throw new Error(`Zusätzliche Route in ${tour.id} hat keine GPX-Datei.`);
        const routeStats = routes[route.gpx];
        if (!routeStats) throw new Error(`Routendaten für ${route.gpx} fehlen. Bitte zuerst npm run routes ausführen.`);
        return {
          gpxKey: route.gpx,
          routeStats,
          durationMin: route.durationMin ?? null,
          stations: route.stations,
        };
      });
      const primary = routeRecord(tour);
      return {
        id: tour.id,
        season_slug: season.slug,
        collection_slug: collection.slug,
        title: primary.title,
        teaser: primary.teaser,
        planned_by: primary.plannedBy,
        meeting_time: primary.meetingTime,
        meeting_place: primary.meetingPlace,
        stations: primary.stations,
        highlight: primary.highlight,
        duration_min: primary.durationMin,
        gpx_key: primary.gpxKey,
        route_stats: primary.routeStats,
        alternative: tour.alternative ? routeRecord(tour.alternative) : null,
        additional_routes: additionalRouteRecords,
      };
    }),
  ),
);

const seasonWrite = await client.from('seasons').upsert(seasonRows);
if (seasonWrite.error) throw new Error(`Import in seasons fehlgeschlagen: ${seasonWrite.error.message}`);
console.log(`[seed] ${seasonRows.length} Datensätze in seasons übertragen`);

const collectionWrite = await client.from('collections').upsert(collectionRows);
if (collectionWrite.error) throw new Error(`Import in collections fehlgeschlagen: ${collectionWrite.error.message}`);
console.log(`[seed] ${collectionRows.length} Datensätze in collections übertragen`);

const tourWrite = await client.from('tours').upsert(tourRows);
if (tourWrite.error) throw new Error(`Import in tours fehlgeschlagen: ${tourWrite.error.message}`);
console.log(`[seed] ${tourRows.length} Datensätze in tours übertragen`);
