import { useEffect, useState } from "react";
import { inFlightFraction } from "@/lib/disclosure/progress";

/** How far through the photo being analyzed the bar is (0 to 0.99). Restarts when `key` changes. */
export function useInFlightFraction(key: unknown, active: boolean): number {
  const [part, setPart] = useState(0);
  useEffect(() => {
    setPart(0);
    if (!active) return;
    const start = Date.now();
    const id = setInterval(() => setPart(inFlightFraction(Date.now() - start)), 100);
    return () => clearInterval(id);
  }, [key, active]);
  return part;
}
