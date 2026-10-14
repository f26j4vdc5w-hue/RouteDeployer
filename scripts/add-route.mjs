import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { constants } from 'node:fs';
import {
  copyFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const catalogPath = join(root, 'src/data/catalog.ts');
const viteConfigPath = join(root, 'vite.config.ts');
const routesRoot = join(root, 'public/routes');
const toursRoot = join(root, 'src/data/seasons');

const rl = createInterface({ input: stdin, output: stdout });
const inputLines = rl[Symbol.asyncIterator]();

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function quote(value) {
  return JSON.stringify(value);
}

function matchBracket(source, openIndex) {
  const opening = source[openIndex];
  const closing = opening === '[' ? ']' : '}';
  let depth = 0;
  let quoteChar = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quoteChar) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quoteChar) quoteChar = null;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      i++;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quoteChar = char;
      continue;
    }
    if (char === opening) depth++;
    if (char === closing && --depth === 0) return i;
  }

  throw new Error(`Schließende Klammer ${closing} nicht gefunden.`);
}

function parseCatalog(source) {
  const imports = new Map();
  const importPattern =
    /import\s*\{\s*tours\s+as\s+(\w+)\s*\}\s*from\s*['"]\.\/seasons\/(\d+)\/([^/'"]+)\/tours['"];?/g;
  for (const match of source.matchAll(importPattern)) {
    imports.set(match[1], { year: match[2], collectionSlug: match[3] });
  }

  const seasons = [];
  const seasonPattern =
    /\{\s*slug:\s*['"]([^'"]+)['"],\s*label:\s*['"]([^'"]+)['"],\s*collections:\s*\[/g;
  for (const match of source.matchAll(seasonPattern)) {
    const openIndex = match.index + match[0].lastIndexOf('[');
    const closeIndex = matchBracket(source, openIndex);
    const collectionSource = source.slice(openIndex + 1, closeIndex);
    const collections = [];
    const collectionPattern =
      /\{\s*slug:\s*['"]([^'"]+)['"],\s*label:\s*['"]([^'"]+)['"],\s*tours:\s*(\w+)/g;
    for (const collectionMatch of collectionSource.matchAll(collectionPattern)) {
      const imported = imports.get(collectionMatch[3]);
      if (!imported) {
        throw new Error(`Import für ${collectionMatch[3]} in catalog.ts nicht gefunden.`);
      }
      collections.push({
        slug: collectionMatch[1],
        label: collectionMatch[2],
        year: imported.year,
        importName: collectionMatch[3],
      });
    }
    const firstYear = collections[0]?.year;
    const year = firstYear ?? seasonYearFromSlug(match[1]);
    seasons.push({
      slug: match[1],
      label: match[2],
      year,
      collections,
      collectionArrayOpen: openIndex,
    });
  }

  if (seasons.length === 0) throw new Error('Keine Saison in src/data/catalog.ts gefunden.');
  return seasons;
}

function seasonYearFromSlug(slug) {
  const match = /^s(\d{2})$/.exec(slug);
  return match ? `20${match[1]}` : null;
}

function addImport(source, importName, year, collectionSlug) {
  const imports = [...source.matchAll(/^import .*;\r?$/gm)];
  if (imports.length === 0) throw new Error('Keine Imports in catalog.ts gefunden.');
  const lastImport = imports.at(-1);
  const insertAt = lastImport.index + lastImport[0].length;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const line = `import { tours as ${importName} } from './seasons/${year}/${collectionSlug}/tours';`;
  return `${source.slice(0, insertAt)}${newline}${line}${source.slice(insertAt)}`;
}

function registerCollection(source, season, collection, importName) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const entry =
    `      { slug: ${quote(collection.slug)}, label: ${quote(collection.label)}, ` +
    `tours: ${importName}, startLabel: ${quote(collection.startLabel)}, ` +
    `endLabel: ${quote(collection.endLabel)} },`;

  if (season) {
    const closeIndex = matchBracket(source, season.collectionArrayOpen);
    return `${source.slice(0, closeIndex)}${newline}${entry}${newline}    ${source.slice(closeIndex)}`;
  }

  const seasonsArray = /export\s+const\s+seasons:\s*Season\[\]\s*=\s*\[/m.exec(source);
  if (!seasonsArray) throw new Error('Saison-Array in catalog.ts nicht gefunden.');
  const openIndex = seasonsArray.index + seasonsArray[0].lastIndexOf('[');
  const closeIndex = matchBracket(source, openIndex);
  const yearLabel = `S${collection.year.slice(-2)}`;
  const newSeason =
    `  {${newline}` +
    `    slug: ${quote(collection.seasonSlug)},${newline}` +
    `    label: ${quote(yearLabel)},${newline}` +
    `    collections: [${newline}${entry}${newline}    ],${newline}` +
    `  },${newline}`;
  return `${source.slice(0, closeIndex)}${newline}${newSeason}${source.slice(closeIndex)}`;
}

function registerVitePath(source, seasonSlug, collectionSlug) {
  const match = /const COLLECTION_PATHS = \[([\s\S]*?)\];/.exec(source);
  if (!match) throw new Error('COLLECTION_PATHS in vite.config.ts nicht gefunden.');
  const routePath = `${seasonSlug}/${collectionSlug}`;
  if (match[1].split(',').some((value) => value.trim().replace(/^['"]|['"]$/g, '') === routePath)) {
    return source;
  }
  const insertAt = match.index + match[0].lastIndexOf(']');
  const content = match[1];
  const separator = content.trim() && !content.trimEnd().endsWith(',') ? ',' : '';
  const entry = `${separator}\n  ${quote(routePath)},\n`;
  return `${source.slice(0, insertAt)}${entry}${source.slice(insertAt)}`;
}

function formatRoute(route, indent, id = null) {
  const pad = ' '.repeat(indent);
  const lines = ['{'];
  if (id) lines.push(`${pad}id: ${quote(id)},`);
  for (const key of ['title', 'teaser', 'meetingTime', 'meetingPlace']) {
    lines.push(`${pad}${key}: ${quote(route[key])},`);
  }
  lines.push(`${pad}stations: ${JSON.stringify(route.stations)},`);
  lines.push(`${pad}gpx: ${quote(route.gpx)},`);
  if (route.durationMin != null) lines.push(`${pad}durationMin: ${route.durationMin},`);
  if (route.alternative) {
    const alternativeLines = formatRoute(route.alternative, indent + 2).split('\n');
    lines.push(`${pad}alternative: ${alternativeLines.join('\n')},`);
  }
  lines.push(`${' '.repeat(indent - 2)}}`);
  return lines.join('\n');
}

function findTourEntry(source, id) {
  const arrayMatch = /export\s+const\s+tours:\s*Tour\[\]\s*=\s*\[/m.exec(source);
  if (!arrayMatch) throw new Error('Touren-Array in tours.ts nicht gefunden.');
  const openIndex = arrayMatch.index + arrayMatch[0].lastIndexOf('[');
  const closeIndex = matchBracket(source, openIndex);

  const matches = [];
  let cursor = openIndex + 1;
  while (cursor < closeIndex) {
    while (cursor < closeIndex && /[\s,]/.test(source[cursor])) cursor++;
    if (cursor >= closeIndex) break;
    if (source[cursor] !== '{') {
      throw new Error('Unerwarteter Inhalt im tours-Array; Eintrag kann nicht sicher erkannt werden.');
    }
    const entryEnd = matchBracket(source, cursor);
    const entrySource = source.slice(cursor, entryEnd + 1);
    const idMatch = /\bid:\s*(['"])(.*?)\1/.exec(entrySource);
    if (idMatch?.[2] === id) {
      const alternativeIndex = entrySource.search(/\balternative\s*:/);
      const mainRouteSource =
        alternativeIndex < 0 ? entrySource : entrySource.slice(0, alternativeIndex);
      const gpxMatch = /\bgpx:\s*(['"])(.*?)\1/.exec(mainRouteSource);
      matches.push({
        start: cursor,
        end: entryEnd + 1,
        hasGpx: Boolean(gpxMatch),
        gpxPath: gpxMatch?.[2] ?? null,
      });
    }
    cursor = entryEnd + 1;
  }

  if (matches.length > 1) {
    throw new Error(`Für den ${id} gibt es mehrere Einträge; bitte bereinige tours.ts zuerst.`);
  }
  return matches[0] ?? null;
}

function upsertTour(source, tour) {
  const existing = findTourEntry(source, tour.id);
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const entry = `  ${formatRoute(tour, 4, tour.id)},${newline}`;
  if (existing) {
    return `${source.slice(0, existing.start)}${formatRoute(tour, 4, tour.id)}${source.slice(existing.end)}`;
  }
  const arrayMatch = /export\s+const\s+tours:\s*Tour\[\]\s*=\s*\[/m.exec(source);
  if (!arrayMatch) throw new Error('Touren-Array in tours.ts nicht gefunden.');
  const openIndex = arrayMatch.index + arrayMatch[0].lastIndexOf('[');
  const closeIndex = matchBracket(source, openIndex);
  return `${source.slice(0, closeIndex)}${newline}${entry}${source.slice(closeIndex)}`;
}

async function ask(question, defaultValue = '') {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  stdout.write(`${question}${suffix}: `);
  const line = await inputLines.next();
  if (line.done) throw new Error('Eingabe wurde beendet.');
  const answer = String(line.value).trim();
  return answer || defaultValue;
}

async function askRequired(question, defaultValue = '') {
  while (true) {
    const answer = await ask(question, defaultValue);
    if (answer) return answer;
    console.log('Bitte einen Wert eingeben.');
  }
}

async function choose(question, options, allowNew = false) {
  options.forEach((option, index) => console.log(`  ${index + 1}) ${option.label}`));
  if (allowNew) console.log('  N) Neu erstellen');
  while (true) {
    const answer = (await ask(question)).toLowerCase();
    if (allowNew && answer === 'n') return null;
    const index = Number(answer) - 1;
    if (Number.isInteger(index) && index >= 0 && index < options.length) {
      return options[index].value;
    }
    console.log('Bitte eine angezeigte Nummer oder N eingeben.');
  }
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

async function promptDate() {
  while (true) {
    const value = await askRequired('Datum (YYYY-MM-DD)');
    if (validDate(value)) return value;
    console.log('Bitte ein gültiges Datum im Format YYYY-MM-DD eingeben.');
  }
}

async function promptTime(defaultValue = '') {
  while (true) {
    const value = await askRequired('Treffzeit (HH:MM)', defaultValue);
    if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
    console.log('Bitte eine Uhrzeit zwischen 00:00 und 23:59 eingeben.');
  }
}

function readMeetingDefaults(source) {
  const declaration = /const\s+MEETING\s*=\s*\{([\s\S]*?)\};/.exec(source);
  if (!declaration) return null;
  const readStringProperty = (key) => {
    const property = new RegExp(`${key}:\\s*(?:"([^"]*)"|'([^']*)')`).exec(declaration[1]);
    return property?.[1] ?? property?.[2] ?? null;
  };
  const meetingTime = readStringProperty('meetingTime');
  const meetingPlace = readStringProperty('meetingPlace');
  return meetingTime && meetingPlace ? { meetingTime, meetingPlace } : null;
}

async function promptDuration() {
  while (true) {
    const value = await ask('Dauer in Minuten (optional)');
    if (!value) return undefined;
    const duration = Number(value);
    if (Number.isFinite(duration) && duration > 0) return Math.round(duration);
    console.log('Bitte eine positive Minutenzahl oder nichts eingeben.');
  }
}

async function promptStations(defaultStations = []) {
  const value = await askRequired(
    'Orte/Stationen, durch Komma getrennt',
    defaultStations.join(', '),
  );
  return value.split(',').map((station) => station.trim()).filter(Boolean);
}

function cleanInputPath(value) {
  return value.replace(/^["']|["']$/g, '');
}

async function promptGpx(title, destinationDirectory) {
  const sourceValue = await askRequired('Pfad zur vorhandenen GPX-Datei');
  const source = resolve(root, cleanInputPath(sourceValue));
  let sourceStat;
  try {
    sourceStat = await stat(source);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`GPX-Datei nicht gefunden: ${source}`);
    throw error;
  }
  if (!sourceStat.isFile() || extname(source).toLowerCase() !== '.gpx') {
    throw new Error('Der angegebene Quellpfad muss auf eine .gpx-Datei zeigen.');
  }

  const suggestedName = `${slugify(title) || 'route'}.gpx`;
  let fileName = await ask('Dateiname im Routenordner', suggestedName);
  fileName = basename(fileName);
  if (extname(fileName).toLowerCase() !== '.gpx') fileName += '.gpx';
  if (!slugify(fileName.slice(0, -4))) {
    throw new Error('Der GPX-Dateiname muss mindestens einen Buchstaben oder eine Ziffer enthalten.');
  }

  const xml = await readFile(source, 'utf8');
  const pointCount = [...xml.matchAll(/<(?:trkpt|rtept)\b/g)].length;
  if (pointCount < 2) {
    throw new Error('Die GPX-Datei muss mindestens zwei Track- oder Routenpunkte enthalten.');
  }
  return {
    source,
    destination: join(destinationDirectory, fileName),
    relativePath: relative(routesRoot, join(destinationDirectory, fileName)).split(sep).join('/'),
  };
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function nextImportName(collectionSlug, year, source) {
  const base =
    `${collectionSlug.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase())}${year}`;
  const existing = new Set([...source.matchAll(/import\s*\{\s*tours\s+as\s+(\w+)/g)].map((m) => m[1]));
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base}${suffix}`)) suffix++;
  return `${base}${suffix}`;
}

async function main() {
  const catalogSource = await readFile(catalogPath, 'utf8');
  const catalogSeasons = parseCatalog(catalogSource);
  const seasonChoice = await choose(
    '\nSaison auswählen (Nummer oder N)',
    catalogSeasons.map((season) => ({
      label: `${season.label} (${season.year ?? 'Jahr unbekannt'})`,
      value: season,
    })),
    true,
  );

  let season;
  let seasonIsNew = false;
  if (seasonChoice) {
    season = seasonChoice;
  } else {
    const year = await askRequired('Jahr der neuen Saison (YYYY)');
    if (!/^\d{4}$/.test(year)) throw new Error('Das Saisonjahr muss vierstellig sein.');
    const seasonSlug = `s${year.slice(-2)}`;
    if (catalogSeasons.some((entry) => entry.slug === seasonSlug)) {
      throw new Error(`Die Saison ${seasonSlug} ist bereits registriert; wähle sie aus der Liste.`);
    }
    season = {
      slug: seasonSlug,
      label: `S${year.slice(-2)}`,
      year,
      collections: [],
    };
    seasonIsNew = true;
  }

  const collectionChoice = await choose(
    '\nKollektion auswählen (Nummer oder N)',
    season.collections.map((collection) => ({
      label: `${collection.label} (${collection.slug})`,
      value: collection,
    })),
    true,
  );
  const collectionIsNew = !collectionChoice;
  let collection;
  if (collectionChoice) {
    collection = collectionChoice;
  } else {
    const label = await askRequired('Name der neuen Kollektion');
    const suggestedSlug = slugify(label);
    const slug = slugify(await ask('URL-/Ordnername', suggestedSlug));
    if (!slug) throw new Error('Der Kollektion-Slug ist leer oder ungültig.');
    if (season.collections.some((entry) => entry.slug === slug)) {
      throw new Error(`Die Kollektion ${slug} existiert in dieser Saison bereits.`);
    }
    const isCamp = slug.includes('camp');
    collection = {
      slug,
      label,
      year: season.year,
      startLabel: await ask('Beschriftung am Tourenanfang', isCamp ? 'ANREISE' : 'SAISONBEGINN'),
      endLabel: await ask('Beschriftung am Tourenende', isCamp ? 'ABREISE' : 'SAISONENDE'),
    };
  }

  if (!/^\d{4}$/.test(collection.year ?? '')) {
    throw new Error(`Für ${season.slug}/${collection.slug} konnte kein vierstelliges Jahr ermittelt werden.`);
  }

  const tourDirectory = join(toursRoot, collection.year, collection.slug);
  const toursFile = join(tourDirectory, 'tours.ts');
  const routeDirectory = join(routesRoot, collection.year, collection.slug);
  const existingToursSource =
    !collectionIsNew && await exists(toursFile) ? await readFile(toursFile, 'utf8') : '';
  const meetingDefaults = readMeetingDefaults(existingToursSource);
  if (meetingDefaults) {
    console.log(
      `\nStandard-Treffpunkt und -Uhrzeit aus MEETING: ${meetingDefaults.meetingPlace}, ${meetingDefaults.meetingTime} Uhr (Enter übernimmt den Standard).`,
    );
  }
  const id = await promptDate();
  const existingTour = existingToursSource ? findTourEntry(existingToursSource, id) : null;
  if (existingTour?.hasGpx) {
    const overwrite = (await ask(`Für ${id} gibt es bereits eine Tour mit GPX. Überschreiben? (j/N)`))
      .toLowerCase()
      .startsWith('j');
    if (!overwrite) {
      console.log('Abgebrochen; der vorhandene Toureneintrag bleibt unverändert.');
      return;
    }
  } else if (existingTour) {
    console.log(`Für ${id} gibt es bereits einen Eintrag ohne GPX; dieser wird ersetzt.`);
  }
  const title = await askRequired('Tour-Titel');
  const teaser = await askRequired('Kurzbeschreibung');
  const meetingTime = await promptTime(meetingDefaults?.meetingTime);
  const meetingPlace = await askRequired('Treffpunkt', meetingDefaults?.meetingPlace ?? '');
  const stations = await promptStations();
  const mainGpx = await promptGpx(title, routeDirectory);
  const durationMin = await promptDuration();
  const tour = {
    id,
    title,
    teaser,
    meetingTime,
    meetingPlace,
    stations,
    gpx: mainGpx.relativePath,
    durationMin,
  };

  const addAlternative = (await ask('Soll eine Alternativroute (Variante B) hinzugefügt werden? (j/N)'))
    .toLowerCase()
    .startsWith('j');
  let alternativeGpx;
  if (addAlternative) {
    const alternativeTitle = await askRequired('Alternativroute Titel');
    const alternativeTeaser = await askRequired('Alternativroute Kurzbeschreibung');
    const alternativeStations = await promptStations(stations);
    alternativeGpx = await promptGpx(alternativeTitle, routeDirectory);
    const alternativeDuration = await promptDuration();
    tour.alternative = {
      title: alternativeTitle,
      teaser: alternativeTeaser,
      meetingTime,
      meetingPlace,
      stations: alternativeStations,
      gpx: alternativeGpx.relativePath,
      durationMin: alternativeDuration,
    };
  }

  const catalogImportName = collectionIsNew
    ? nextImportName(collection.slug, collection.year, catalogSource)
    : null;
  const viteSource = await readFile(viteConfigPath, 'utf8');

  const replaceExistingGpx =
    existingTour?.gpxPath === mainGpx.relativePath && (await exists(mainGpx.destination));
  if ((await exists(mainGpx.destination)) && !replaceExistingGpx) {
    throw new Error(`Die Zieldatei existiert bereits: ${mainGpx.destination}`);
  }
  if (alternativeGpx && mainGpx.destination === alternativeGpx.destination) {
    throw new Error('Haupttour und Alternativroute müssen unterschiedliche GPX-Dateinamen haben.');
  }
  if (alternativeGpx && await exists(alternativeGpx.destination)) {
    throw new Error(`Die alternative GPX-Zieldatei existiert bereits: ${alternativeGpx.destination}`);
  }
  if (!collectionIsNew && !(await exists(toursFile))) {
    throw new Error(`Tourendatei der vorhandenen Kollektion fehlt: ${toursFile}`);
  }

  let toursSource = (await exists(toursFile))
    ? existingToursSource || await readFile(toursFile, 'utf8')
    : `import type { Tour } from '../../../../domain/tour';\n\nexport const tours: Tour[] = [\n];\n`;
  toursSource = upsertTour(toursSource, tour);

  let catalogUpdated = catalogSource;
  if (collectionIsNew) {
    catalogUpdated = addImport(catalogUpdated, catalogImportName, collection.year, collection.slug);
    const currentSeason = seasonIsNew
      ? null
      : parseCatalog(catalogUpdated).find((entry) => entry.slug === season.slug);
    catalogUpdated = registerCollection(
      catalogUpdated,
      currentSeason,
      { ...collection, seasonSlug: season.slug },
      catalogImportName,
    );
  }
  const viteUpdated = registerVitePath(viteSource, season.slug, collection.slug);

  console.log('\nFolgende Änderungen werden vorgenommen:');
  console.log(`- Tour: ${id} – ${title}`);
  console.log(`- GPX: ${mainGpx.destination}`);
  if (alternativeGpx) console.log(`- Alternative GPX: ${alternativeGpx.destination}`);
  console.log(`- Tourendatei: ${toursFile}${collectionIsNew ? ' (neu)' : ''}`);
  if (collectionIsNew) console.log(`- Katalog: neue Kollektion ${season.slug}/${collection.slug}`);
  if (seasonIsNew) console.log(`- Saison: ${season.slug} (${season.year})`);
  console.log(`- Build-Pfad: ${season.slug}/${collection.slug}`);
  if (!(await ask('\nÄnderungen jetzt schreiben? (j/N)')).toLowerCase().startsWith('j')) {
    console.log('Abgebrochen; es wurden keine Dateien geändert.');
    return;
  }

  await mkdir(routeDirectory, { recursive: true });
  await mkdir(tourDirectory, { recursive: true });
  await copyFile(
    mainGpx.source,
    mainGpx.destination,
    replaceExistingGpx ? 0 : constants.COPYFILE_EXCL,
  );
  if (alternativeGpx) {
    await copyFile(alternativeGpx.source, alternativeGpx.destination, constants.COPYFILE_EXCL);
  }
  await writeFile(toursFile, toursSource);
  if (collectionIsNew) await writeFile(catalogPath, catalogUpdated);
  if (viteUpdated !== viteSource) await writeFile(viteConfigPath, viteUpdated);

  console.log('\nBerechne die Routendaten neu ...');
  const npmCommand = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm';
  const npmArgs =
    process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run routes'] : ['run', 'routes'];
  execFileSync(npmCommand, npmArgs, { cwd: root, stdio: 'inherit' });
  console.log('\nRoute hinzugefügt. Bitte lokal im Browser kontrollieren und anschließend committen.');
}

main()
  .catch((error) => {
    console.error(`\nFehler: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
