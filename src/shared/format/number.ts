const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

export const formatNumber = (value: number) => number.format(value);

export const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
};

/** Grobe Schätzung bei fehlender Angabe: 25 km/h plus 1 h je 1000 Höhenmeter. */
export const estimateDurationMin = (distanceKm: number, ascentM: number | null) =>
  Math.round((distanceKm / 25) * 60 + ((ascentM ?? 0) / 1000) * 60);
