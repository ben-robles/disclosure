// Fixed defect taxonomy. The model may only choose from these ids.
// Keep ids in step with assets/defect_taxonomy.json.
export const TAXONOMY = [
  { id: "roof", label: "Roof damage", description: "Missing/curling shingles, flashing, sagging", pro: "Roofer" },
  { id: "chimney_fireplace", label: "Chimney / fireplace", description: "Spalling brick, failed mortar, leaning chimney, damaged crown", pro: "Chimney sweep / mason" },
  { id: "gutters_downspouts", label: "Gutters / downspouts", description: "Detached, sagging, clogged or leaking; missing downspouts", pro: "Gutter contractor" },
  { id: "grading_drainage", label: "Grading / yard drainage", description: "Ground sloping toward the house, standing water, erosion", pro: "Landscaper / drainage contractor" },
  { id: "siding_exterior", label: "Siding / exterior", description: "Rotted or missing siding and trim, cracked stucco, failed caulk", pro: "Siding contractor / carpenter" },
  { id: "deck_porch", label: "Deck / porch", description: "Rotted boards, corroded posts, pulling-away ledger", pro: "Deck contractor / carpenter" },
  { id: "walkways_retaining", label: "Walkways / retaining wall", description: "Heaved or cracked concrete, trip edges, leaning wall", pro: "Concrete / masonry contractor" },
  { id: "water_intrusion", label: "Water intrusion", description: "Water stains, active leak, moisture damage", pro: "Plumber or roofer (by location)" },
  { id: "basement_moisture", label: "Basement / crawl space moisture", description: "Standing water, mineral deposits, water lines, sump pump trouble", pro: "Waterproofing contractor" },
  { id: "mold_mildew", label: "Mold or mildew", description: "Visible mold or mildew growth", pro: "Mold remediation specialist" },
  { id: "foundation_structural", label: "Foundation / structural", description: "Cracks in foundation, walls, or structural members; bowed walls, sagging beams", pro: "Structural engineer" },
  { id: "electrical", label: "Electrical hazard", description: "Exposed wiring, scorched outlets, missing covers, improvised wiring", pro: "Electrician" },
  { id: "electrical_panel", label: "Electrical panel", description: "Open or rusted panel, double-tapped or scorched breakers", pro: "Electrician" },
  { id: "plumbing", label: "Plumbing", description: "Leaking/corroded pipes, fixture leaks, failed supply lines", pro: "Plumber" },
  { id: "water_heater", label: "Water heater", description: "Rust or leaks at the tank, corroded fittings, missing relief pipe", pro: "Plumber" },
  { id: "hvac_heating", label: "Heating system", description: "Rusted or scorched furnace/boiler, bad flue, soot, damaged ducts", pro: "HVAC technician" },
  { id: "hvac_cooling", label: "Cooling system", description: "Damaged outdoor unit, bent coil fins, missing line insulation", pro: "HVAC technician" },
  { id: "insulation_ventilation", label: "Insulation / ventilation", description: "Missing or wet insulation, blocked attic vents, condensation", pro: "Insulation contractor" },
  { id: "window_door_rot", label: "Window / door damage", description: "Rotted frames, broken glass/seals, doors that don't close", pro: "Carpenter / window installer" },
  { id: "wall_ceiling_finishes", label: "Wall / ceiling finishes", description: "Cracked drywall, nail pops, peeling paint, sagging ceiling", pro: "Drywall contractor / painter" },
  { id: "flooring", label: "Flooring", description: "Buckled or lifting boards, broken tile, soft or sloping floor", pro: "Flooring contractor" },
  { id: "stairs_railings", label: "Stairs / railings", description: "Loose, missing or low handrails and guardrails; damaged steps", pro: "Carpenter" },
  { id: "pest_wood_damage", label: "Pest / wood damage", description: "Termite tubes, carpenter ant damage, rodent evidence", pro: "Pest control" },
  { id: "safety_alarms", label: "Smoke / CO alarms", description: "Missing, painted-over or old alarms, disconnected units", pro: "Electrician / fire safety installer" },
  { id: "hazmat_suspect", label: "Suspected hazardous material", description: "Popcorn ceiling, old floor tile, wrapped pipe insulation, flaking old paint", pro: "Certified asbestos / lead tester" },
  { id: "septic_sewer", label: "Septic / sewer", description: "Sewage on the ground, broken cleanout or lid, soggy drain field", pro: "Septic contractor / plumber" },
  { id: "fire_smoke_damage", label: "Fire / smoke damage", description: "Charred framing, scorch marks, soot staining", pro: "Fire restoration contractor" },
  { id: "unclear", label: "Couldn't identify", description: "Not clear enough from the photo", pro: null },
] as const;

export type DefectType = (typeof TAXONOMY)[number]["id"];
export const DEFECT_IDS = TAXONOMY.map((t) => t.id) as DefectType[];

export function defectInfo(id: DefectType) {
  return TAXONOMY.find((t) => t.id === id) ?? TAXONOMY.find((t) => t.id === "unclear")!;
}
