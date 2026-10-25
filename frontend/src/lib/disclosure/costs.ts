import type { DefectType } from "./taxonomy";

// PLACEHOLDER — verify before any real use. Region: DC/MD/VA metro. USD.
// Researched from public cost guides (Oct 2026), not contractor quotes. Keep in sync with assets/cost_table.json,
// which documents the job assumed in each bucket.
export const COST_TABLE_META = {
  status: "PLACEHOLDER: verify before any real use",
  region: "DC/MD/VA metro",
  caption: "Estimate. Varies by region and contractor.",
};

type Bucket = "low" | "mid" | "high";
type Range = { low: number; high: number; avg: number };

export const COST_TABLE: Record<DefectType, Record<Bucket, Range> | null> = {
  roof: { low: { low: 350, high: 900, avg: 650 }, mid: { low: 1500, high: 4000, avg: 2500 }, high: { low: 9000, high: 18000, avg: 12000 } },
  water_intrusion: { low: { low: 300, high: 900, avg: 550 }, mid: { low: 1200, high: 3000, avg: 2000 }, high: { low: 4000, high: 12000, avg: 7500 } },
  mold_mildew: { low: { low: 400, high: 1000, avg: 650 }, mid: { low: 1500, high: 4000, avg: 2500 }, high: { low: 5000, high: 14000, avg: 8500 } },
  foundation_structural: { low: { low: 500, high: 1500, avg: 900 }, mid: { low: 2500, high: 7500, avg: 5000 }, high: { low: 10000, high: 30000, avg: 18000 } },
  electrical: { low: { low: 150, high: 450, avg: 300 }, mid: { low: 600, high: 2000, avg: 1200 }, high: { low: 3000, high: 9000, avg: 5500 } },
  plumbing: { low: { low: 200, high: 600, avg: 400 }, mid: { low: 700, high: 2500, avg: 1500 }, high: { low: 5000, high: 10000, avg: 7500 } },
  window_door_rot: { low: { low: 250, high: 800, avg: 500 }, mid: { low: 1200, high: 3500, avg: 2200 }, high: { low: 7000, high: 15000, avg: 10000 } },
  pest_wood_damage: { low: { low: 350, high: 900, avg: 600 }, mid: { low: 1500, high: 4500, avg: 2800 }, high: { low: 5000, high: 15000, avg: 9000 } },
  chimney_fireplace: { low: { low: 450, high: 1200, avg: 800 }, mid: { low: 1500, high: 3500, avg: 2200 }, high: { low: 5000, high: 12000, avg: 8000 } },
  gutters_downspouts: { low: { low: 150, high: 450, avg: 300 }, mid: { low: 900, high: 2000, avg: 1400 }, high: { low: 3000, high: 6500, avg: 4500 } },
  grading_drainage: { low: { low: 300, high: 900, avg: 550 }, mid: { low: 2000, high: 5000, avg: 3200 }, high: { low: 6000, high: 14000, avg: 9500 } },
  siding_exterior: { low: { low: 250, high: 900, avg: 550 }, mid: { low: 1500, high: 4500, avg: 2800 }, high: { low: 11000, high: 22000, avg: 15000 } },
  deck_porch: { low: { low: 400, high: 1200, avg: 800 }, mid: { low: 1500, high: 4000, avg: 2500 }, high: { low: 8000, high: 20000, avg: 13000 } },
  walkways_retaining: { low: { low: 250, high: 900, avg: 550 }, mid: { low: 1500, high: 4500, avg: 2800 }, high: { low: 6000, high: 14000, avg: 8800 } },
  basement_moisture: { low: { low: 400, high: 1200, avg: 750 }, mid: { low: 2000, high: 4500, avg: 3000 }, high: { low: 5000, high: 12000, avg: 7500 } },
  electrical_panel: { low: { low: 250, high: 700, avg: 450 }, mid: { low: 1500, high: 3000, avg: 2200 }, high: { low: 3000, high: 5500, avg: 4000 } },
  water_heater: { low: { low: 150, high: 500, avg: 300 }, mid: { low: 1200, high: 2200, avg: 1600 }, high: { low: 2500, high: 5000, avg: 3500 } },
  hvac_heating: { low: { low: 200, high: 700, avg: 450 }, mid: { low: 1200, high: 3000, avg: 2000 }, high: { low: 5000, high: 9000, avg: 6500 } },
  hvac_cooling: { low: { low: 200, high: 700, avg: 450 }, mid: { low: 1500, high: 3500, avg: 2500 }, high: { low: 5500, high: 10000, avg: 7500 } },
  insulation_ventilation: { low: { low: 300, high: 900, avg: 550 }, mid: { low: 1700, high: 3500, avg: 2400 }, high: { low: 4500, high: 10000, avg: 7000 } },
  wall_ceiling_finishes: { low: { low: 100, high: 500, avg: 300 }, mid: { low: 600, high: 1800, avg: 1100 }, high: { low: 2500, high: 7000, avg: 4500 } },
  flooring: { low: { low: 300, high: 1000, avg: 600 }, mid: { low: 1500, high: 4000, avg: 2600 }, high: { low: 6000, high: 15000, avg: 10000 } },
  stairs_railings: { low: { low: 200, high: 800, avg: 500 }, mid: { low: 900, high: 2500, avg: 1500 }, high: { low: 2500, high: 7000, avg: 4500 } },
  safety_alarms: { low: { low: 100, high: 350, avg: 200 }, mid: { low: 350, high: 900, avg: 600 }, high: { low: 900, high: 2000, avg: 1400 } },
  hazmat_suspect: { low: { low: 300, high: 900, avg: 600 }, mid: { low: 1200, high: 3500, avg: 2100 }, high: { low: 6000, high: 18000, avg: 10000 } },
  septic_sewer: { low: { low: 300, high: 900, avg: 600 }, mid: { low: 2500, high: 6000, avg: 3300 }, high: { low: 10000, high: 25000, avg: 15000 } },
  fire_smoke_damage: { low: { low: 1000, high: 3500, avg: 2000 }, mid: { low: 5000, high: 12000, avg: 8000 }, high: { low: 15000, high: 40000, avg: 25000 } },
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

const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;

export function formatCost(r: Pick<Range, "low" | "high"> | null): string {
  if (!r) return "No estimate";
  return `${dollars(r.low)}–${dollars(r.high)}`;
}

export function formatAvg(r: Pick<Range, "avg"> | null): string {
  return r ? dollars(r.avg) : "";
}
