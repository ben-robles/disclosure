// Fixed defect taxonomy. The model may only choose from these ids.
export const TAXONOMY = [
  { id: "roof", label: "Roof damage", description: "Missing/curling shingles, flashing, sagging", pro: "Roofer" },
  { id: "water_intrusion", label: "Water intrusion", description: "Water stains, active leak, moisture damage", pro: "Plumber or roofer (by location)" },
  { id: "mold_mildew", label: "Mold or mildew", description: "Visible mold or mildew growth", pro: "Mold remediation specialist" },
  { id: "foundation_structural", label: "Foundation / structural", description: "Cracks in foundation, walls, or structural members", pro: "Structural engineer" },
  { id: "electrical", label: "Electrical hazard", description: "Exposed wiring, scorched outlets, open panel, missing covers", pro: "Electrician" },
  { id: "plumbing", label: "Plumbing", description: "Leaking/corroded pipes, fixture leaks, water heater issues", pro: "Plumber" },
  { id: "window_door_rot", label: "Window / door damage", description: "Rotted frames, broken glass/seals, doors that don't close", pro: "Carpenter / window installer" },
  { id: "pest_wood_damage", label: "Pest / wood damage", description: "Termite tubes, carpenter ant damage, rodent evidence", pro: "Pest control" },
  { id: "unclear", label: "Can't determine", description: "Cannot determine from photo", pro: "Licensed home inspector" },
] as const;

export type DefectType = (typeof TAXONOMY)[number]["id"];
export const DEFECT_IDS = TAXONOMY.map((t) => t.id) as DefectType[];

export function defectInfo(id: DefectType) {
  return TAXONOMY.find((t) => t.id === id) ?? TAXONOMY[8]!;
}
