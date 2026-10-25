import { useEffect, useState } from "react";
import { inFlightFraction } from "@/lib/disclosure/progress";
import { getExpectedPhotoMs } from "@/lib/disclosure/store";

/** How far through the photo being analyzed we probably are (0 to 0.95). Restarts when `key` changes. */
export function useInFlightFraction(key: unknown, active: boolean): number {
  const [part, setPart] = useState(0);
  useEffect(() => {
    setPart(0);
    if (!active) return;
    const start = Date.now();
    const expected = getExpectedPhotoMs();
    const id = setInterval(() => setPart(inFlightFraction(Date.now() - start, expected)), 250);
    return () => clearInterval(id);
  }, [key, active]);
  return part;
}
