import type { DefectType } from "./taxonomy";

// PLACEHOLDER — verify before any real use. Region: DC/MD/VA metro. USD.
export const COST_TABLE_META = {
  status: "PLACEHOLDER: verify before any real use",
  region: "DC/MD/VA metro",
  caption: "Estimate. Varies by region and contractor.",
};

type Bucket = "low" | "mid" | "high";
type Range = { low: number; high: number };

export const COST_TABLE: Record<DefectType, Record<Bucket, Range> | null> = {
  roof: { low: { low: 300, high: 1500 }, mid: { low: 1000, high: 5000 }, high: { low: 5000, high: 20000 } },
  water_intrusion: { low: { low: 200, high: 1000 }, mid: { low: 1000, high: 5000 }, high: { low: 3000, high: 15000 } },
  mold_mildew: { low: { low: 200, high: 1000 }, mid: { low: 1000, high: 4000 }, high: { low: 3000, high: 15000 } },
  foundation_structural: { low: { low: 500, high: 2000 }, mid: { low: 2000, high: 10000 }, high: { low: 10000, high: 40000 } },
  electrical: { low: { low: 150, high: 600 }, mid: { low: 500, high: 2500 }, high: { low: 2000, high: 8000 } },
  plumbing: { low: { low: 150, high: 700 }, mid: { low: 500, high: 3000 }, high: { low: 2000, high: 10000 } },
  window_door_rot: { low: { low: 200, high: 800 }, mid: { low: 500, high: 2500 }, high: { low: 2000, high: 8000 } },
  pest_wood_damage: { low: { low: 200, high: 1000 }, mid: { low: 1000, high: 4000 }, high: { low: 3000, high: 15000 } },
  unclear: null,
};

export function bucketFor(severity: number): Bucket {
  if (severity <= 2) return "low";
  if (severity === 3) return "mid";
  return "high";
}

export function lookupCost(type: DefectType, severity: number): Range | null {
  return COST_TABLE[type]?.[bucketFor(severity)] ?? null;
}

export function formatCost(r: Range | null): string {
  if (!r) return "No estimate";
  const f = (n: number) => `$${n.toLocaleString("en-US")}`;
  return `${f(r.low)}–${f(r.high)}`;
}
