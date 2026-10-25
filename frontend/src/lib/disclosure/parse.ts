import { z } from "zod";
import { DEFECT_IDS, type DefectType } from "./taxonomy";

export const rawFindingSchema = z.object({
  defect_type: z.string(),
  severity: z.number().int().min(1).max(5),
  urgency: z.enum(["immediate", "30_days", "1_year", "cosmetic"]),
  confidence: z.enum(["high", "medium", "low"]),
  image_quality: z.enum(["ok", "blurry", "not_a_house"]),
  reason: z.string(),
  // Model's own name for what it sees; used instead of the category label when the category does not fit.
  title: z.string().optional(),
  category_fits: z.union([z.boolean(), z.string()]).optional(),
});

export type RawFinding = Omit<z.infer<typeof rawFindingSchema>, "defect_type" | "title" | "category_fits"> & {
  defect_type: DefectType;
  title?: string;
  category_fits?: boolean;
};

/** Plain short name from the model; empty when unusable. */
export function cleanTitle(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/_/g, " ").split(/\s+/).filter(Boolean).slice(0, 6).join(" ").replace(/^[\s.]+|[\s.]+$/g, "").slice(0, 60);
}

/** Missing or unreadable means the model did not object to the category. */
export function categoryFits(v: unknown): boolean {
  if (typeof v === "string") return !["false", "no", "0"].includes(v.trim().toLowerCase());
  return v !== false;
}

export const UNCLEAR_FALLBACK: RawFinding = {
  defect_type: "unclear",
  severity: 1,
  urgency: "cosmetic",
  confidence: "low",
  image_quality: "ok",
  reason: "We couldn't read the analysis result. Try again.",
};

/** Parse model text defensively. Returns null if unusable (caller retries once, then uses UNCLEAR_FALLBACK). */
export function parseModelOutput(text: string): RawFinding | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    return null;
  }
  const r = rawFindingSchema.safeParse(obj);
  if (!r.success) return null;
  const d = r.data;
  const type = (DEFECT_IDS as string[]).includes(d.defect_type) ? (d.defect_type as DefectType) : "unclear";
  const out: RawFinding = {
    ...d,
    defect_type: type,
    reason: d.reason.split(/\s+/).slice(0, 20).join(" "),
    title: cleanTitle(d.title),
    category_fits: categoryFits(d.category_fits),
  };
  if (out.confidence === "low") out.defect_type = "unclear";
  return out;
}
