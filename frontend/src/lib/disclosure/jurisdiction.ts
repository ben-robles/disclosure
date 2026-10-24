import type { DefectType } from "./taxonomy";

// Maryland Residential Property Disclosure and Disclaimer Statement.
// Item numbers and headings follow the official form (dllr.state.md.us/forms/propertydanddform.pdf).
export const JURISDICTION = { name: "Maryland", form: "Residential Property Disclosure and Disclaimer Statement" };

export const MD_SECTIONS: Record<DefectType, string> = {
  foundation_structural: "3. Foundation",
  water_intrusion: "4. Basement",
  roof: "5. Roof",
  window_door_rot: "6. Other Structural Systems",
  plumbing: "7. Plumbing System",
  electrical: "10. Electric Systems",
  pest_wood_damage: "17. Wood-destroying Insects",
  mold_mildew: "25. Other Material Defects",
  unclear: "25. Other Material Defects",
};

/** Leading item number of a section name, for ordering in form order. */
export const sectionNumber = (s: string) => parseInt(s, 10) || 0;
