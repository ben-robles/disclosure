import { z } from "zod";
import { DEFECT_IDS, type DefectType } from "./taxonomy";

export const rawFindingSchema = z.object({
  defect_type: z.string(),
  severity: z.number().int().min(1).max(5),
  urgency: z.enum(["immediate", "30_days", "1_year", "cosmetic"]),
  confidence: z.enum(["high", "medium", "low"]),
  image_quality: z.enum(["ok", "blurry", "not_a_house"]),
  reason: z.string(),
});

export type RawFinding = Omit<z.infer<typeof rawFindingSchema>, "defect_type"> & { defect_type: DefectType };

export const UNCLEAR_FALLBACK: RawFinding = {
  defect_type: "unclear",
  severity: 1,
  urgency: "cosmetic",
  confidence: "low",
  image_quality: "ok",
  reason: "Could not read the analysis result.",
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
  const out: RawFinding = { ...d, defect_type: type, reason: d.reason.split(/\s+/).slice(0, 20).join(" ") };
  if (out.confidence === "low") out.defect_type = "unclear";
  return out;
}
