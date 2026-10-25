import { parseModelOutput, UNCLEAR_FALLBACK, type RawFinding } from "./parse";

export type AnalyzeResult = RawFinding & { timedOut?: boolean; unavailable?: boolean };

/** The ONE boundary to the model. Swap mockAnalyzer for a Gemma 4 implementation later. */
export interface DefectAnalyzer {
  analyze(imageDataUrl: string): Promise<AnalyzeResult>;
}

export const TIMEOUT_MS = 120_000;

/** Wraps any raw-text model call with: one retry on bad JSON, then unclear; timeout → unclear. */
export function makeAnalyzer(callModel: (img: string) => Promise<string>): DefectAnalyzer {
  return {
    async analyze(img) {
      const withTimeout = (p: Promise<string>) =>
        Promise.race([
          p,
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT_MS)),
        ]);
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          const parsed = parseModelOutput(await withTimeout(callModel(img)));
          if (parsed) return parsed;
        }
        return UNCLEAR_FALLBACK;
      } catch {
        return { ...UNCLEAR_FALLBACK, reason: "The analysis took too long.", timedOut: true };
      }
    },
  };
}

// Mock: cycles through sample outputs, including every guardrail case.
const SAMPLES: RawFinding[] = [
  {
    defect_type: "water_intrusion",
    severity: 3,
    urgency: "30_days",
    confidence: "high",
    image_quality: "ok",
    reason: "Brown ring-shaped stain on ceiling drywall suggests a past or slow active leak.",
  },
  {
    defect_type: "electrical",
    severity: 4,
    urgency: "immediate",
    confidence: "medium",
    image_quality: "ok",
    reason: "Outlet cover missing with exposed wire ends and scorch marks around the box.",
  },
  {
    defect_type: "unclear",
    severity: 1,
    urgency: "cosmetic",
    confidence: "low",
    image_quality: "blurry",
    reason: "Too blurry to make out any detail.",
  },
  {
    defect_type: "foundation_structural",
    severity: 2,
    urgency: "1_year",
    confidence: "high",
    image_quality: "ok",
    reason: "Thin hairline crack in poured foundation wall, no visible displacement.",
  },
  {
    defect_type: "unclear",
    severity: 1,
    urgency: "cosmetic",
    confidence: "low",
    image_quality: "not_a_house",
    reason: "Photo shows an animal, not part of a home.",
  },
  {
    defect_type: "mold_mildew",
    severity: 3,
    urgency: "30_days",
    confidence: "medium",
    image_quality: "ok",
    reason: "Dark speckled growth along bathroom ceiling corner near the vent.",
  },
  {
    defect_type: "unclear",
    severity: 2,
    urgency: "1_year",
    confidence: "low",
    image_quality: "ok",
    reason: "There's discoloration, but the cause isn't clear from this angle.",
  },
  {
    defect_type: "roof",
    severity: 5,
    urgency: "immediate",
    confidence: "high",
    image_quality: "ok",
    reason: "Several shingles missing and exposed underlayment near the ridge.",
  },
];

let counter = 0;
export const mockAnalyzer: DefectAnalyzer = makeAnalyzer(async () => {
  await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));
  const s = SAMPLES[counter++ % SAMPLES.length];
  return JSON.stringify(s);
});

const UNAVAILABLE: AnalyzeResult = {
  ...UNCLEAR_FALLBACK,
  reason: "The AI model server is not reachable.",
  unavailable: true,
};

/** Gemma 4 through the local Python backend (POST /api/analyze, proxied by Vite).
 *  The backend strips EXIF, retries bad JSON once and times out at 120 s. */
export const gemmaAnalyzer: DefectAnalyzer = {
  async analyze(img) {
    let res: Response;
    try {
      const body = new FormData();
      body.append("file", await (await fetch(img)).blob(), "photo.jpg");
      res = await fetch("/api/analyze", { method: "POST", body });
    } catch {
      return UNAVAILABLE;
    }
    if (!res.ok) return UNAVAILABLE;
    const data = (await res.json()) as { analysis_status?: string };
    if (data.analysis_status === "timeout")
      return { ...UNCLEAR_FALLBACK, reason: "The analysis took too long.", timedOut: true };
    if (data.analysis_status === "unavailable") return UNAVAILABLE;
    return parseModelOutput(JSON.stringify(data)) ?? UNCLEAR_FALLBACK;
  },
};

// VITE_MOCK_ANALYZER=1 runs the UI with canned results and no backend.
export const analyzer: DefectAnalyzer =
  import.meta.env["VITE_MOCK_ANALYZER"] === "1" ? mockAnalyzer : gemmaAnalyzer;

/** True when the local Python backend answers /api/health; the Photos screen warns if not. */
export async function backendHealthy(): Promise<boolean> {
  try {
    return (await fetch("/api/health")).ok;
  } catch {
    return false;
  }
}
