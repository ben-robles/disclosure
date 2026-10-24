import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppShell, NoSession } from "@/components/disclosure/AppShell";
import { addPhoto, removePhoto, resizeImage, runQueue, useSession } from "@/lib/disclosure/store";

export const Route = createFileRoute("/capture")({
  head: () => ({
    meta: [
      { title: "Add photos — Disclosure" },
      { name: "description", content: "Take or choose photos of defects in your home for analysis." },
      { property: "og:title", content: "Add photos — Disclosure" },
      { property: "og:description", content: "Take or choose photos of defects in your home for analysis." },
    ],
  }),
  component: Capture,
});

function Capture() {
  const session = useSession();
  const input = useRef<HTMLInputElement>(null);
  const [nudge, setNudge] = useState(false);
  const [started, setStarted] = useState(false);
  if (!session) return <NoSession />;

  const photos = session.photos;
  const total = photos.length;
  const done = photos.filter((p) => p.status === "done").length;
  const busy = photos.some((p) => p.status !== "done");
  const analyzing = (started || photos.some((p) => p.status === "analyzing")) && busy;
  const current = Math.min(done + 1, total);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) addPhoto(await resizeImage(f));
    setNudge(true);
    if (input.current) input.current.value = "";
  }

  return (
    <AppShell
      title="Add photos"
      footer={
        analyzing ? (
          <div aria-live="polite">
            <p className="mb-2 font-semibold">Analyzing {current} of {total}</p>
            <Progress value={(done / total) * 100} aria-label={`Analyzing ${current} of ${total}`} />
          </div>
        ) : total > 0 && !busy ? (
          <Button asChild size="xl"><Link to="/findings">See findings</Link></Button>
        ) : (
          <Button size="xl" disabled={total === 0} onClick={() => { setStarted(true); void runQueue(); }}>
            Analyze {total > 0 ? `${total} photo${total > 1 ? "s" : ""}` : ""}
          </Button>
        )
      }
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        id="photo-input"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button size="xl" variant="secondary" className="h-28 flex-col gap-1 border-2 border-dashed border-primary" onClick={() => input.current?.click()}>
        <Camera className="size-8" aria-hidden />
        Take / choose photo
      </Button>

      {nudge && (
        <p className="mt-4 rounded-lg bg-accent p-3 text-accent-foreground" role="status">
          Add another angle of this problem? More angles help the analysis.
        </p>
      )}

      {total > 0 && (
        <ul className="mt-6 grid grid-cols-3 gap-3" aria-label="Photos added">
          {photos.map((p, i) => (
            <li key={p.id} className="relative">
              <img src={p.dataUrl} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
              <span className="absolute bottom-1 left-1 rounded bg-background px-1 text-xs font-medium">
                {p.status === "done" ? "Done" : p.status === "analyzing" ? "Analyzing…" : "Waiting"}
              </span>
              {p.status !== "analyzing" && (
                <button
                  onClick={() => removePhoto(p.id)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute -right-2 -top-2 flex size-11 items-center justify-center"
                >
                  <span className="flex size-7 items-center justify-center rounded-full border bg-background"><X className="size-4" aria-hidden /></span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        Analysis keeps going if you leave this page. Come back any time to see progress.
      </p>
    </AppShell>
  );
}
