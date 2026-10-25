// The model reports no partial progress, so the photo in flight fills on a fixed clock and waits at
// 99% if the photo takes longer. Pure function; the timer lives in useInFlightFraction.

/** Time for the bar of one photo to fill. */
export const PHOTO_MS = 8_000;
const HOLD = 0.99;

/** Share of the photo in flight that is done: linear over PHOTO_MS, then held at 99% until it finishes. */
export function inFlightFraction(elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return Math.min(HOLD, elapsedMs / PHOTO_MS);
}
