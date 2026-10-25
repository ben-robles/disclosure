import { useSyncExternalStore } from "react";
import { analyzer, type AnalyzeResult } from "./analyzer";
import { gradeRange, type Letter, type Urgency } from "./grading";
import { defectInfo, type DefectType } from "./taxonomy";

export type PhotoStatus = "queued" | "analyzing" | "done";

export type Photo = {
  id: string;
  dataUrl: string;
  status: PhotoStatus;
  result?: AnalyzeResult | undefined;
  // user edits
  defect_type?: DefectType | undefined;
  severity?: number | undefined;
  confirmed: boolean;
};

export type Session = { id: string; zip: string; address?: string; sellerName?: string; photos: Photo[]; createdAt: number; maxStep?: number };

const KEY = "disclosure.session.v1";
let session: Session | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function persist() {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage full or unavailable */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) session = JSON.parse(raw);
  } catch {
    session = null;
  }
  // resume interrupted analysis
  if (session) {
    session.photos.forEach((p) => p.status === "analyzing" && (p.status = "queued"));
    if (session.photos.some((p) => p.status === "queued")) void runQueue();
  }
}

function subscribe(l: () => void) {
  ensureLoaded();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSession(): Session | null {
  return useSyncExternalStore(
    subscribe,
    () => session,
    () => null,
  );
}

export function useHydratedSession() {
  const s = useSession();
  return { session: s, ready: typeof window !== "undefined" && loaded };
}

const uid = () => Math.random().toString(36).slice(2, 10);

function update(fn: (s: Session) => Session) {
  if (!session) return;
  session = fn(session);
  emit();
}

export function startSession(zip: string, extra: { address?: string; sellerName?: string } = {}) {
  ensureLoaded();
  session = { id: uid(), zip, ...extra, photos: [], createdAt: Date.now() };
  emit();
}

/** Unlock a step. Only called from Continue buttons, so URLs and the step bar cannot skip ahead. */
export function reachStep(n: number) {
  update((s) => ((s.maxStep ?? 1) >= n ? s : { ...s, maxStep: n }));
}

export function deleteSession() {
  session = null;
  emit();
}

export function addPhoto(dataUrl: string) {
  update((s) => ({ ...s, photos: [...s.photos, { id: uid(), dataUrl, status: "queued", confirmed: false }] }));
}

export function patchPhoto(id: string, patch: Partial<Photo>) {
  update((s) => ({ ...s, photos: s.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
}

export function removePhoto(id: string) {
  update((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== id) }));
}

export function retryPhoto(id: string) {
  patchPhoto(id, { status: "queued", result: undefined, confirmed: false });
  void runQueue();
}

let running = false;
export async function runQueue() {
  if (running) return;
  running = true;
  try {
    while (session) {
      const next = session.photos.find((p) => p.status === "queued");
      if (!next) break;
      patchPhoto(next.id, { status: "analyzing" });
      const result = await analyzer.analyze(next.dataUrl);
      if (!session?.photos.some((p) => p.id === next.id)) continue;
      patchPhoto(next.id, { status: "done", result, defect_type: result.defect_type, severity: result.severity });
    }
  } finally {
    running = false;
  }
}

export const OTHER_ISSUE = "Other issue";

/** Category label, unless the model said the category does not fit what it saw. Then its own title
 *  is shown (the category list never changes). A hand-picked category always shows its own label. */
export function findingTitle(label: string, r: AnalyzeResult, untouched: boolean): string {
  if (!untouched || r.category_fits !== false) return label;
  return r.title?.trim() || OTHER_ISSUE;
}

/** Derived view of a finding with edits applied. */
export type GuardKind = "blurry" | "not_a_house" | "low_confidence" | "timeout" | "unavailable" | null;

export function viewFinding(p: Photo) {
  const r = p.result!;
  const type = p.defect_type ?? r.defect_type;
  const severity = p.severity ?? r.severity;
  const guard: GuardKind = r.timedOut
    ? "timeout"
    : r.unavailable
      ? "unavailable"
      : r.image_quality === "blurry"
      ? "blurry"
      : r.image_quality === "not_a_house"
        ? "not_a_house"
        : r.confidence === "low"
          ? "low_confidence"
          : null;
  const range: Letter[] | null =
    guard || type === "unclear" ? null : gradeRange(severity, r.urgency as Urgency, r.confidence);
  const info = defectInfo(guard ? "unclear" : type);
  return { type: guard ? ("unclear" as DefectType) : type, severity, urgency: r.urgency as Urgency, confidence: r.confidence, reason: r.reason, guard, range, info, title: findingTitle(info.label, r, !guard && p.defect_type === r.defect_type) };
}

export const GUARD_MESSAGE: Record<Exclude<GuardKind, null>, string> = {
  blurry: "This photo is too blurry to read. Retake it closer and in better light.",
  not_a_house: "This doesn't look like part of a home. Try a photo of the problem area.",
  low_confidence: "The AI couldn't make out what this is, so it hasn't graded it.",
  timeout: "This took too long to analyze. Try again.",
  unavailable: "The AI model isn't running on this computer. Start it with .\\run.ps1, then try again.",
};

/** Resize to max 1024px long edge; re-encoding through canvas also drops EXIF. */
export function resizeImage(file: File, max = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export const DISCLAIMER = "AI-assisted documentation aid. Not a home inspection and not legal advice.";
