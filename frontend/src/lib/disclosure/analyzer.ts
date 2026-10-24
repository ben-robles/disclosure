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
        return { ...UNCLEAR_FALLBACK, reason: "Analysis timed out.", timedOut: true };
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
    reason: "Image is too blurry to identify any surface detail.",
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
    reason: "Discoloration visible but cause cannot be determined from this angle.",
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

// ---- Real backend: FastAPI + Gemma 4 on this computer (see app/main.py) ----

type BackendPhoto = {
  id: string;
  analyzed: boolean;
  state?: "graded" | "blurry" | "not_a_house" | "cant_tell" | "timeout" | "unavailable";
  defect_type?: string;
  severity?: number;
  urgency?: RawFinding["urgency"];
  confidence?: RawFinding["confidence"];
  reason?: string;
};

const POLL_MS = 1500;
const POLL_LIMIT_MS = 10 * 60 * 1000;
const UNAVAILABLE: AnalyzeResult = {
  ...UNCLEAR_FALLBACK,
  reason: "The AI could not be reached.",
  unavailable: true,
};

let backendSession: Promise<string> | null = null;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T;
}

function ensureBackendSession(): Promise<string> {
  backendSession ??= api<{ id: string }>("/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
    .then((r) => r.id)
    .catch((e) => {
      backendSession = null;
      throw e;
    });
  return backendSession;
}

export async function backendHealthy(): Promise<boolean> {
  try {
    await api("/health");
    return true;
  } catch {
    return false;
  }
}

function toResult(p: BackendPhoto): AnalyzeResult {
  const base: RawFinding = {
    defect_type: (p.defect_type as RawFinding["defect_type"]) ?? "unclear",
    severity: p.severity ?? 1,
    urgency: p.urgency ?? "cosmetic",
    confidence: p.confidence ?? "low",
    image_quality: "ok",
    reason: p.reason ?? "",
  };
  switch (p.state) {
    case "blurry":
    case "not_a_house":
      return { ...base, defect_type: "unclear", confidence: "low", image_quality: p.state };
    case "cant_tell":
      return { ...base, defect_type: "unclear", confidence: "low" };
    case "timeout":
      return { ...base, defect_type: "unclear", confidence: "low", timedOut: true };
    case "unavailable":
      return { ...UNAVAILABLE, reason: p.reason || UNAVAILABLE.reason };
    default:
      return base;
  }
}

export const backendAnalyzer: DefectAnalyzer = {
  async analyze(img) {
    try {
      const sid = await ensureBackendSession();
      const form = new FormData();
      form.append("file", await (await fetch(img)).blob(), "photo.jpg");
      const { id } = await api<{ id: string }>(`/session/${sid}/photos`, {
        method: "POST",
        body: form,
      });
      await api(`/session/${sid}/analyze`, { method: "POST" });
      const deadline = Date.now() + POLL_LIMIT_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const view = await api<{ photos: BackendPhoto[] }>(`/session/${sid}`);
        const mine = view.photos.find((p) => p.id === id);
        if (mine?.analyzed) return toResult(mine);
      }
      return { ...UNCLEAR_FALLBACK, reason: "Analysis timed out.", timedOut: true };
    } catch {
      backendSession = null;
      return UNAVAILABLE;
    }
  },
};

export const analyzer: DefectAnalyzer = backendAnalyzer;
