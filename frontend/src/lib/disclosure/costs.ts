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
  chimney_fireplace: { low: { low: 300, high: 1000 }, mid: { low: 1000, high: 4000 }, high: { low: 4000, high: 15000 } },
  gutters_downspouts: { low: { low: 100, high: 500 }, mid: { low: 500, high: 1500 }, high: { low: 1500, high: 6000 } },
  grading_drainage: { low: { low: 300, high: 1200 }, mid: { low: 1200, high: 5000 }, high: { low: 5000, high: 20000 } },
  siding_exterior: { low: { low: 200, high: 1000 }, mid: { low: 1000, high: 5000 }, high: { low: 5000, high: 25000 } },
  deck_porch: { low: { low: 200, high: 1000 }, mid: { low: 1000, high: 5000 }, high: { low: 5000, high: 25000 } },
  walkways_retaining: { low: { low: 200, high: 1000 }, mid: { low: 1000, high: 5000 }, high: { low: 5000, high: 30000 } },
  basement_moisture: { low: { low: 300, high: 1200 }, mid: { low: 1200, high: 5000 }, high: { low: 5000, high: 20000 } },
  electrical_panel: { low: { low: 200, high: 800 }, mid: { low: 800, high: 3000 }, high: { low: 3000, high: 10000 } },
  water_heater: { low: { low: 150, high: 600 }, mid: { low: 600, high: 2000 }, high: { low: 1500, high: 5000 } },
  hvac_heating: { low: { low: 150, high: 600 }, mid: { low: 600, high: 3000 }, high: { low: 3000, high: 12000 } },
  hvac_cooling: { low: { low: 150, high: 600 }, mid: { low: 600, high: 3000 }, high: { low: 3000, high: 10000 } },
  insulation_ventilation: { low: { low: 200, high: 1000 }, mid: { low: 1000, high: 3500 }, high: { low: 3500, high: 12000 } },
  wall_ceiling_finishes: { low: { low: 100, high: 600 }, mid: { low: 600, high: 2500 }, high: { low: 2500, high: 10000 } },
  flooring: { low: { low: 200, high: 1000 }, mid: { low: 1000, high: 4000 }, high: { low: 4000, high: 15000 } },
  stairs_railings: { low: { low: 150, high: 600 }, mid: { low: 600, high: 2500 }, high: { low: 2500, high: 8000 } },
  safety_alarms: { low: { low: 50, high: 300 }, mid: { low: 300, high: 800 }, high: { low: 800, high: 2500 } },
  hazmat_suspect: { low: { low: 300, high: 1000 }, mid: { low: 1000, high: 5000 }, high: { low: 5000, high: 25000 } },
  septic_sewer: { low: { low: 300, high: 1000 }, mid: { low: 1000, high: 5000 }, high: { low: 5000, high: 30000 } },
  fire_smoke_damage: { low: { low: 300, high: 1500 }, mid: { low: 1500, high: 8000 }, high: { low: 8000, high: 50000 } },
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
