import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppShell, Disclaimer, NoSession } from "@/components/disclosure/AppShell";
import { GradeBadge } from "@/components/disclosure/GradeBadge";
import { QuoteButton } from "@/components/disclosure/QuoteSheet";
import { COST_TABLE_META, formatCost, lookupCost } from "@/lib/disclosure/costs";
import { URGENCY_LABEL } from "@/lib/disclosure/grading";
import { TAXONOMY, type DefectType } from "@/lib/disclosure/taxonomy";
import {
  GUARD_MESSAGE, patchPhoto, removePhoto, resizeImage, retryPhoto, runQueue, useSession, viewFinding, type Photo,
} from "@/lib/disclosure/store";

export const Route = createFileRoute("/findings")({
  head: () => ({
    meta: [
      { title: "Findings — Disclosure" },
      { name: "description", content: "Confirm, edit, or remove each AI-classified defect finding." },
      { property: "og:title", content: "Findings — Disclosure" },
      { property: "og:description", content: "Confirm, edit, or remove each AI-classified defect finding." },
    ],
  }),
  component: Findings,
});

function Findings() {
  const session = useSession();
  if (!session) return <NoSession />;
  const confirmed = session.photos.filter((p) => p.confirmed).length;
  return (
    <AppShell
      title="Findings"
      footer={
        confirmed === 0 ? (
          <div className="space-y-2">
            <Button size="xl" disabled className="opacity-100 bg-muted text-muted-foreground shadow-none">
              Review 0 confirmed
            </Button>
            <p className="text-center text-sm text-muted-foreground">Confirm at least one finding to continue.</p>
          </div>
        ) : (
          <Button asChild size="xl"><Link to="/review">Review {confirmed} confirmed</Link></Button>
        )
      }
    >
      <Disclaimer />
      <p className="mt-3 text-sm text-muted-foreground">Only confirmed findings go in the report.</p>
      <ul className="mt-4 space-y-4">
        {session.photos.map((p, i) => (
          <li key={p.id}><FindingCard photo={p} index={i} /></li>
        ))}
      </ul>
      <Button asChild variant="outline" size="xl" className="mt-6"><Link to="/capture">Add more photos</Link></Button>
    </AppShell>
  );
}

function FindingCard({ photo, index }: { photo: Photo; index: number }) {
  const [editing, setEditing] = useState(false);
  const retake = useRef<HTMLInputElement>(null);
  if (photo.status !== "done" || !photo.result) {
    return (
      <div className="rounded-xl border p-4 text-muted-foreground">
        Photo {index + 1}: {photo.status === "analyzing" ? "Analyzing…" : "Waiting to analyze"}
      </div>
    );
  }
  const f = viewFinding(photo);
  const thumb = <img src={photo.dataUrl} alt={`Photo ${index + 1}: ${f.info.label}`} className="size-20 shrink-0 rounded-lg object-cover" />;

  if (f.guard) {
    return (
      <article className="rounded-xl border-2 border-dashed bg-muted p-4" aria-label={`Photo ${index + 1}, needs attention`}>
        <div className="flex gap-3">
          {thumb}
          <div>
            <p className="font-semibold">{GUARD_MESSAGE[f.guard]}</p>
            {f.guard === "low_confidence" && <p className="mt-1 text-sm text-muted-foreground">Recommended: Licensed home inspector</p>}
          </div>
        </div>
        <input ref={retake} type="file" accept="image/*" capture="environment" className="sr-only" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          patchPhoto(photo.id, { dataUrl: await resizeImage(file), status: "queued", result: undefined, confirmed: false, defect_type: undefined, severity: undefined });
          void runQueue();
        }} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {f.guard === "timeout" ? (
            <Button size="touch" onClick={() => retryPhoto(photo.id)}>Retry</Button>
          ) : (
            <Button size="touch" onClick={() => retake.current?.click()}>Retake</Button>
          )}
          <Button size="touch" variant="outline" onClick={() => removePhoto(photo.id)}>Delete</Button>
        </div>
      </article>
    );
  }

  const cost = lookupCost(f.type, f.severity);
  return (
    <article className="rounded-xl border bg-card p-4" aria-label={`Photo ${index + 1}, ${f.info.label}`}>
      <div className="flex gap-3">
        {thumb}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-tight">{f.info.label}</h2>
          <div className="mt-2"><GradeBadge range={f.range} /></div>
        </div>
      </div>
      <p className="mt-3">{f.reason}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Urgency</dt><dd className="font-medium">{URGENCY_LABEL[f.urgency]}</dd>
        <dt className="text-muted-foreground">Severity</dt><dd className="font-medium">{f.severity} of 5</dd>
        <dt className="text-muted-foreground">Confidence</dt><dd className="font-medium capitalize">{f.confidence}</dd>
        <dt className="text-muted-foreground">Cost</dt><dd className="font-medium">{formatCost(cost)}</dd>
      </dl>
      <p className="mt-1 text-xs text-muted-foreground">{COST_TABLE_META.caption}</p>
      <div className="mt-3"><QuoteButton pro={f.info.pro} /></div>

      {editing && (
        <div className="mt-4 space-y-3 rounded-lg bg-muted p-3">
          <div className="space-y-1">
            <Label htmlFor={`type-${photo.id}`}>Defect type</Label>
            <Select value={f.type} onValueChange={(v) => patchPhoto(photo.id, { defect_type: v as DefectType })}>
              <SelectTrigger id={`type-${photo.id}`} className="h-11 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TAXONOMY.filter((t) => t.id !== "unclear").map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`sev-${photo.id}`}>Severity</Label>
            <Select value={String(f.severity)} onValueChange={(v) => patchPhoto(photo.id, { severity: Number(v) })}>
              <SelectTrigger id={`sev-${photo.id}`} className="h-11 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} of 5</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button size="touch" variant={photo.confirmed ? "default" : "outline"} aria-pressed={photo.confirmed}
          onClick={() => patchPhoto(photo.id, { confirmed: !photo.confirmed })}>
          {photo.confirmed && <Check aria-hidden />}{photo.confirmed ? "Confirmed" : "Confirm"}
        </Button>
        <Button size="touch" variant="outline" aria-expanded={editing} onClick={() => setEditing(!editing)}>{editing ? "Done" : "Edit"}</Button>
        <Button size="touch" variant="outline" onClick={() => removePhoto(photo.id)}>Delete</Button>
      </div>
    </article>
  );
}
