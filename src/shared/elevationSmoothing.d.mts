export const ASCENT_SMOOTHING_WINDOW_M: number;
export const ASCENT_SAMPLE_SPACING_M: number;

export interface SmoothedAscentPoint {
  distanceM: number;
  elevationM: number;
  ascentM: number;
}

export interface SmoothedAscentProfile {
  points: SmoothedAscentPoint[];
  distanceM: number;
  ascentM: number;
}

export function createSmoothedAscentProfile(
  distancesM: readonly number[],
  elevationsM: readonly (number | null)[],
  windowM?: number,
  sampleSpacingM?: number,
): SmoothedAscentProfile;
