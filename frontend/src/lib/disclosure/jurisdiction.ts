import type { DefectType } from "./taxonomy";

// Maryland Residential Property Disclosure and Disclaimer Statement.
// Item numbers and headings follow the official form (dllr.state.md.us/forms/propertydanddform.pdf).
export const JURISDICTION = { name: "Maryland", form: "Residential Property Disclosure and Disclaimer Statement" };

export const MD_SECTIONS: Record<DefectType, string> = {
  foundation_structural: "3. Foundation",
  water_intrusion: "4. Basement",
  basement_moisture: "4. Basement",
  roof: "5. Roof",
  window_door_rot: "6. Other Structural Systems",
  chimney_fireplace: "6. Other Structural Systems",
  siding_exterior: "6. Other Structural Systems",
  deck_porch: "6. Other Structural Systems",
  wall_ceiling_finishes: "6. Other Structural Systems",
  flooring: "6. Other Structural Systems",
  stairs_railings: "6. Other Structural Systems",
  plumbing: "7. Plumbing System",
  water_heater: "7. Plumbing System",
  hvac_heating: "8. Heating Systems",
  hvac_cooling: "9. Air Conditioning System",
  electrical: "10. Electric Systems",
  electrical_panel: "10. Electric Systems",
  safety_alarms: "12. Smoke Alarms",
  septic_sewer: "13. Sewer/Septic Systems",
  insulation_ventilation: "15. Insulation",
  gutters_downspouts: "16. Exterior Drainage",
  grading_drainage: "16. Exterior Drainage",
  pest_wood_damage: "17. Wood-destroying Insects",
  hazmat_suspect: "18. Hazardous or Regulated Materials",
  fire_smoke_damage: "24. Flooding or Fire",
  walkways_retaining: "25. Other Material Defects",
  mold_mildew: "25. Other Material Defects",
  unclear: "25. Other Material Defects",
};

/** Leading item number of a section name, for ordering in form order. */
export const sectionNumber = (s: string) => parseInt(s, 10) || 0;
