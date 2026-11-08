export const ASCENT_SMOOTHING_WINDOW_M = 450;
export const ASCENT_SAMPLE_SPACING_M = 10;

function interpolateAt(distancesM, elevationsM, distanceM) {
  let left = 0;
  let right = distancesM.length - 1;
  while (left < right) {
    const middle = Math.ceil((left + right) / 2);
    if (distancesM[middle] <= distanceM) left = middle;
    else right = middle - 1;
  }

  const next = Math.min(left + 1, distancesM.length - 1);
  const span = distancesM[next] - distancesM[left];
  if (span <= 0) return elevationsM[next];
  const fraction = (distanceM - distancesM[left]) / span;
  return elevationsM[left] + (elevationsM[next] - elevationsM[left]) * fraction;
}

function fillMissingElevations(distancesM, elevationsM) {
  const firstValid = elevationsM.findIndex((elevation) => elevation !== null);
  if (firstValid < 0) return null;

  const filled = [...elevationsM];
  let previousValid = firstValid;
  for (let index = firstValid + 1; index < elevationsM.length; index += 1) {
    if (elevationsM[index] !== null) {
      const gap = distancesM[index] - distancesM[previousValid];
      for (let missing = previousValid + 1; missing < index; missing += 1) {
        const fraction = gap > 0 ? (distancesM[missing] - distancesM[previousValid]) / gap : 0;
        filled[missing] =
          elevationsM[previousValid] + (elevationsM[index] - elevationsM[previousValid]) * fraction;
      }
      previousValid = index;
    }
  }

  for (let index = 0; index < firstValid; index += 1) filled[index] = elevationsM[firstValid];
  for (let index = previousValid + 1; index < elevationsM.length; index += 1) {
    filled[index] = elevationsM[previousValid];
  }
  return filled;
}

function median(values) {
  values.sort((left, right) => left - right);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
}

export function createSmoothedAscentProfile(
  distancesM,
  elevationsM,
  windowM = ASCENT_SMOOTHING_WINDOW_M,
  sampleSpacingM = ASCENT_SAMPLE_SPACING_M,
) {
  if (distancesM.length !== elevationsM.length || distancesM.length < 2) {
    throw new Error('Das Höhenprofil benötigt passende Strecken- und Höhenwerte.');
  }

  const filledElevations = fillMissingElevations(distancesM, elevationsM);
  if (!filledElevations) throw new Error('Die GPX-Datei enthält keine Höhenangaben.');

  const totalDistanceM = distancesM.at(-1);
  const sampledDistancesM = [];
  for (let distanceM = 0; distanceM < totalDistanceM; distanceM += sampleSpacingM) {
    sampledDistancesM.push(distanceM);
  }
  if (sampledDistancesM.at(-1) !== totalDistanceM) sampledDistancesM.push(totalDistanceM);
  if (sampledDistancesM.length === 1) sampledDistancesM.push(totalDistanceM);

  const sampledElevationsM = sampledDistancesM.map((distanceM) =>
    interpolateAt(distancesM, filledElevations, distanceM),
  );
  const windowSize = Math.max(1, Math.round(windowM / sampleSpacingM) | 1);
  const halfWindow = Math.floor(windowSize / 2);
  let ascentM = 0;
  const profile = [];
  for (let index = 0; index < sampledDistancesM.length; index += 1) {
    const distanceM = sampledDistancesM[index];
    const start = Math.max(0, index - halfWindow);
    const end = Math.min(sampledElevationsM.length, index + halfWindow + 1);
    const elevationM = median(sampledElevationsM.slice(start, end));
    if (index > 0) ascentM += Math.max(0, elevationM - profile[index - 1].elevationM);
    profile.push({ distanceM, elevationM, ascentM });
  }

  return { points: profile, distanceM: totalDistanceM, ascentM: Math.round(ascentM) };
}
