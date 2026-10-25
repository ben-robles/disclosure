import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell, Disclaimer, NoSession } from "@/components/disclosure/AppShell";
import { GradeBadge } from "@/components/disclosure/GradeBadge";
import {
  ConfidenceBars,
  CostBar,
  GradeScale,
  RiskMatrix,
  SeverityDots,
} from "@/components/disclosure/RiskViz";
import { COST_TABLE_META, formatCost, lookupCost } from "@/lib/disclosure/costs";
import { URGENCY_LABEL, risk } from "@/lib/disclosure/grading";
import { TAXONOMY, type DefectType } from "@/lib/disclosure/taxonomy";
import {
  GUARD_MESSAGE,
  patchPhoto,
  removePhoto,
  resizeImage,
  retryPhoto,
  runQueue,
  useSession,
  viewFinding,
  type Photo,
} from "@/lib/disclosure/store";

export const Route = createFileRoute("/findings")({
  head: () => ({
    meta: [
      { title: "Findings — Disclosure" },
      {
        name: "description",
        content: "Confirm, edit, or remove each AI-classified defect finding.",
      },
      { property: "og:title", content: "Findings — Disclosure" },
      {
        property: "og:description",
        content: "Confirm, edit, or remove each AI-classified defect finding.",
      },
    ],
  }),
  component: Findings,
});

function Findings() {
  const session = useSession();
  if (!session) return <NoSession />;
  const confirmed = session.photos.filter((p) => p.confirmed).length;
  const total = session.photos.length;
  return (
    <AppShell
      step={2}
      title="What we found"
      lead="Only findings you confirm go into the report."
      footer={
        confirmed === 0 ? (
          <div className="space-y-2">
            <Button
              size="xl"
              disabled
              className="opacity-100 bg-muted text-muted-foreground shadow-none"
            >
              Continue to review
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Confirm at least one finding to continue.
            </p>
          </div>
        ) : (
          <Button asChild size="xl">
            <Link to="/review">Continue with {confirmed} confirmed</Link>
          </Button>
        )
      }
    >
      <ProgressBar photos={session.photos} />
      <ul className="space-y-5">
        {session.photos.map((p, i) => (
          <li key={p.id}>
            <FindingCard photo={p} index={i} />
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" size="xl" className="mt-8">
        <Link to="/capture">Add more photos</Link>
      </Button>
      <div className="mt-6">
        <Disclaimer />
      </div>
    </AppShell>
  );
}

// Analysis of one photo takes about a minute with no real progress signal, so the
// photo being analyzed counts as a fraction that creeps toward (never reaches) done.
const ANALYZE_TAU_MS = 45_000;

/** Shows analysis progress while photos are being analyzed, then confirmation progress. */
function ProgressBar({ photos }: { photos: Photo[] }) {
  const total = photos.length;
  const done = photos.filter((p) => p.status === "done").length;
  const confirmed = photos.filter((p) => p.confirmed).length;
  const analyzingId = photos.find((p) => p.status === "analyzing")?.id;
  const [partial, setPartial] = useState(0);

  useEffect(() => {
    setPartial(0);
    if (!analyzingId) return;
    const start = Date.now();
    const timer = setInterval(
      () => setPartial(0.95 * (1 - Math.exp(-(Date.now() - start) / ANALYZE_TAU_MS))),
      500,
    );
    return () => clearInterval(timer);
  }, [analyzingId]);

  const analyzing = done < total;
  const pct = total ? ((analyzing ? done + partial : confirmed) / total) * 100 : 0;
  const label = analyzing
    ? `Analyzing photo ${Math.min(done + 1, total)} of ${total}…`
    : `${confirmed} of ${total} confirmed`;

  return (
    <div
      className="mb-5 flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-[var(--shadow-card)]"
      aria-live="polite"
    >
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label={analyzing ? "Analysis progress" : "Confirmation progress"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className={`h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none ${analyzing ? "motion-safe:animate-pulse" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm font-semibold tabular-nums">{label}</p>
    </div>
  );
}

function FindingCard({ photo, index }: { photo: Photo; index: number }) {
  const [editing, setEditing] = useState(false);
  const retake = useRef<HTMLInputElement>(null);
  if (photo.status !== "done" || !photo.result) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-card p-3 text-muted-foreground">
        <img src={photo.dataUrl} alt="" className="size-14 rounded-md object-cover opacity-70" />
        <p>
          Photo {index + 1}: {photo.status === "analyzing" ? "checking now…" : "waiting its turn"}
        </p>
      </div>
    );
  }
  const f = viewFinding(photo);

  if (f.guard) {
    return (
      <article
        className="overflow-hidden rounded-3xl border bg-muted"
        aria-label={`Photo ${index + 1}, needs attention`}
      >
        <img
          src={photo.dataUrl}
          alt={`Photo ${index + 1}`}
          className="aspect-[16/9] w-full object-cover grayscale"
        />
        <div className="p-4">
          <p className="text-lg font-bold leading-snug">{GUARD_MESSAGE[f.guard]}</p>
          {f.guard === "low_confidence" && (
            <p className="mt-1 text-muted-foreground">
              A licensed home inspector can take a proper look.
            </p>
          )}
          <input
            ref={retake}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              patchPhoto(photo.id, {
                dataUrl: await resizeImage(file),
                status: "queued",
                result: undefined,
                confirmed: false,
                defect_type: undefined,
                severity: undefined,
              });
              void runQueue();
            }}
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {f.guard === "timeout" || f.guard === "unavailable" ? (
              <Button size="touch" onClick={() => retryPhoto(photo.id)}>
                Try again
              </Button>
            ) : (
              <Button size="touch" onClick={() => retake.current?.click()}>
                Retake photo
              </Button>
            )}
            <Button size="touch" variant="outline" onClick={() => removePhoto(photo.id)}>
              Delete
            </Button>
          </div>
        </div>
      </article>
    );
  }

  const cost = lookupCost(f.type, f.severity);
  return (
    <article
      aria-label={`Photo ${index + 1}, ${f.title}`}
      className="rounded-3xl border bg-card p-3 shadow-[var(--shadow-card)]"
    >
      <div className="relative overflow-hidden rounded-2xl">
        <img
          src={photo.dataUrl}
          alt={`Photo ${index + 1}: ${f.title}`}
          className="aspect-[4/3] w-full object-cover"
        />
        <div className="absolute bottom-3 left-3">
          <GradeBadge range={f.range} />
        </div>
        {photo.confirmed && (
          <span className="pop absolute right-3 top-3 flex items-center gap-1 rounded-full bg-grade-a px-2.5 py-1 text-sm font-bold text-white shadow-sm">
            <Check className="size-4" aria-hidden /> Confirmed
          </span>
        )}
      </div>

      <h2 className="mt-3.5 px-1 text-xl font-extrabold leading-tight">{f.title}</h2>
      <p className="mt-1 px-1 text-base text-foreground/85">{f.reason}</p>

      <div className="mt-4">
        <GradeScale range={f.range} />
      </div>

      <div className="mt-4 grid grid-cols-[1fr_9.5rem] items-center gap-4">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">How soon</dt>
            <dd className="font-semibold">{URGENCY_LABEL[f.urgency]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">How bad</dt>
            <dd className="flex items-center gap-2 font-semibold">
              <SeverityDots value={f.severity} /> {f.severity} of 5
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">How sure we are</dt>
            <dd className="flex items-center gap-2 font-semibold capitalize">
              <ConfidenceBars level={f.confidence} /> {f.confidence}
            </dd>
          </div>
        </dl>
        <RiskMatrix severity={f.severity} urgency={f.urgency} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Score {risk(f.severity, f.urgency)} of 20: severity times urgency.
      </p>

      <div className="mt-4 rounded-2xl bg-muted p-3.5">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-muted-foreground">Typical repair</p>
          <p className="text-lg font-bold tabular-nums">{formatCost(cost)}</p>
        </div>
        {cost && (
          <div className="mt-2">
            <CostBar low={cost.low} high={cost.high} />
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{COST_TABLE_META.caption}</p>
      </div>

      {editing && (
        <div className="mt-4 space-y-3 rounded-2xl border bg-background p-3">
          <div className="space-y-1">
            <Label htmlFor={`type-${photo.id}`}>Defect type</Label>
            <Select
              value={f.type}
              onValueChange={(v) => patchPhoto(photo.id, { defect_type: v as DefectType })}
            >
              <SelectTrigger id={`type-${photo.id}`} className="h-11 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAXONOMY.filter((t) => t.id !== "unclear").map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`sev-${photo.id}`}>Severity</Label>
            <Select
              value={String(f.severity)}
              onValueChange={(v) => patchPhoto(photo.id, { severity: Number(v) })}
            >
              <SelectTrigger id={`sev-${photo.id}`} className="h-11 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} of 5
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Button
          size="touch"
          className="flex-1"
          variant={photo.confirmed ? "secondary" : "default"}
          aria-pressed={photo.confirmed}
          onClick={() => patchPhoto(photo.id, { confirmed: !photo.confirmed })}
        >
          {photo.confirmed ? (
            <>
              <Check aria-hidden /> Confirmed
            </>
          ) : (
            "Confirm finding"
          )}
        </Button>
        <Button
          size="touch"
          variant="outline"
          aria-expanded={editing}
          onClick={() => setEditing(!editing)}
        >
          <Pencil aria-hidden /> {editing ? "Done" : "Edit"}
        </Button>
        <Button
          size="touch"
          variant="outline"
          onClick={() => removePhoto(photo.id)}
          aria-label="Delete finding"
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </article>
  );
}
