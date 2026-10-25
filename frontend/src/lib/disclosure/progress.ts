// The model reports no partial progress, so the photo in flight is estimated from how long the
// photos before it took. Pure functions; the timer lives in useInFlightFraction.

/** Used until a photo in this session has finished. A warm model takes about 10 s per photo. */
export const DEFAULT_PHOTO_MS = 12_000;
const MIN_PHOTO_MS = 3_000;
const MAX_PHOTO_MS = 120_000;
const RECENT = 5;

/** Expected time for the next photo: the mean of the last few finished ones. */
export function expectedPhotoMs(finishedMs: number[]): number {
  const recent = finishedMs.slice(-RECENT);
  if (recent.length === 0) return DEFAULT_PHOTO_MS;
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  return Math.min(MAX_PHOTO_MS, Math.max(MIN_PHOTO_MS, mean));
}

/** Share of the photo in flight that is done, from 0 up to 0.95. About 82% at the expected time, and
 *  it keeps creeping, never reaching 1, so a slow photo does not look finished before it is. */
export function inFlightFraction(elapsedMs: number, expectedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return 0.95 * (1 - Math.exp((-2 * elapsedMs) / expectedMs));
}
