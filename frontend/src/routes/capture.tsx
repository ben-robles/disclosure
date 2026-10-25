import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { backendHealthy } from "@/lib/disclosure/analyzer";
import { AppShell, NoSession } from "@/components/disclosure/AppShell";
import { useInFlightFraction } from "@/components/disclosure/useInFlightFraction";
import { addPhoto, removePhoto, resizeImage, runQueue, useSession } from "@/lib/disclosure/store";

export const Route = createFileRoute("/capture")({
  head: () => ({
    meta: [
      { title: "Add photos | Disclosure" },
      {
        name: "description",
        content: "Take or choose photos of defects in your home for analysis.",
      },
      { property: "og:title", content: "Add photos | Disclosure" },
      {
        property: "og:description",
        content: "Take or choose photos of defects in your home for analysis.",
      },
    ],
  }),
  component: Capture,
});

/** Finished photos plus an estimate of the one in flight, as a percentage of all photos. */
function useAnalysisProgress(done: number, total: number, active: boolean) {
  const part = useInFlightFraction(done, active);
  return total > 0 ? ((done + part) / total) * 100 : 0;
}

function Capture() {
  const session = useSession();
  const input = useRef<HTMLInputElement>(null);
  const [nudge, setNudge] = useState(false);
  const [started, setStarted] = useState(false);
  const [aiUp, setAiUp] = useState<boolean | null>(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    void backendHealthy().then(setAiUp);
  }, []);
  useEffect(() => {
    // Without this, a photo dropped outside the drop zone makes the browser open it and leave the app.
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files");
    const block = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, []);
  const photos = session?.photos ?? [];
  const total = photos.length;
  const done = photos.filter((p) => p.status === "done").length;
  const busy = photos.some((p) => p.status !== "done");
  const analyzing = (started || photos.some((p) => p.status === "analyzing")) && busy;
  const current = Math.min(done + 1, total);
  const progress = useAnalysisProgress(done, total, analyzing);
  if (!session) return <NoSession />;

  async function onFiles(files: ArrayLike<File> | null) {
    if (!files) return;
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    for (const f of images) addPhoto(await resizeImage(f));
    if (images.length) setNudge(true);
    if (input.current) input.current.value = "";
  }

  return (
    <AppShell
      step={1}
      title="Add your photos"
      lead="One photo per problem."
      footer={
        analyzing ? (
          <div aria-live="polite">
            <p className="mb-2 font-semibold">
              Looking at photo {current} of {total}
            </p>
            <Progress indeterminate value={progress} aria-label={`Looking at photo ${current} of ${total}`} />
          </div>
        ) : total > 0 && !busy ? (
          <Button asChild size="xl">
            <Link to="/findings">See what we found</Link>
          </Button>
        ) : (
          <Button
            size="xl"
            disabled={total === 0 || aiUp === false}
            onClick={() => {
              setStarted(true);
              void runQueue();
            }}
          >
            {total > 0 ? `Check ${total} photo${total > 1 ? "s" : ""}` : "Add a photo to start"}
          </Button>
        )
      }
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        id="photo-input"
        onChange={(e) => onFiles(e.target.files)}
      />
      {aiUp === false && (
        <p
          className="mb-4 flex gap-2.5 rounded-2xl bg-destructive/10 p-3.5 text-sm font-medium text-destructive"
          role="alert"
        >
          The AI isn't running. Start it with run.ps1, then reload this page.
        </p>
      )}
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void onFiles(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed px-4 py-10 shadow-[var(--shadow-card)] text-center transition-colors hover:border-primary hover:bg-accent ${dragging ? "border-primary bg-accent" : "border-primary/35 bg-card"}`}
      >
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-cta)]">
          <Camera className="size-7" aria-hidden />
        </span>
        <span className="text-lg font-semibold">
          {total ? "Add another photo" : "Take or choose a photo"}
        </span>
      </button>

      {nudge && (
        <p
          className="mt-4 rounded-2xl bg-accent p-3.5 text-sm font-medium text-accent-foreground"
          role="status"
        >
          Got a second angle of the same problem? It helps us read it more accurately.
        </p>
      )}

      {total > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-lg font-bold">
            Your photos{" "}
            <span className="font-normal text-muted-foreground">
              ({done} of {total} checked)
            </span>
          </h2>
          <ul className="grid grid-cols-3 gap-3" aria-label="Photos added">
            {photos.map((p, i) => (
              <li key={p.id} className="relative">
                <img
                  src={p.dataUrl}
                  alt={`Photo ${i + 1}`}
                  className={`aspect-square w-full rounded-2xl object-cover ${p.status === "done" ? "" : "brightness-90"}`}
                />
                {p.status !== "done" && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-foreground/25">
                    {p.status === "analyzing" ? (
                      <Loader2
                        className="size-7 animate-spin text-white motion-reduce:animate-none"
                        aria-hidden
                      />
                    ) : (
                      <span className="rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium">
                        In line
                      </span>
                    )}
                    <span className="sr-only">
                      {p.status === "analyzing" ? "Checking" : "Waiting"}
                    </span>
                  </span>
                )}
                {p.status === "done" && (
                  <span
                    className="absolute bottom-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-grade-a text-white"
                    role="img"
                    aria-label="Checked"
                  >
                    <Check className="size-3.5" aria-hidden />
                  </span>
                )}
                {p.status !== "analyzing" && (
                  <button
                    onClick={() => removePhoto(p.id)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute -right-2 -top-2 flex size-11 items-center justify-center"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full border bg-background shadow-sm">
                      <X className="size-4" aria-hidden />
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}
