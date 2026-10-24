import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Camera, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppShell, NoSession } from "@/components/disclosure/AppShell";
import { addPhoto, removePhoto, resizeImage, runQueue, useSession } from "@/lib/disclosure/store";

export const Route = createFileRoute("/capture")({
  head: () => ({
    meta: [
      { title: "Add photos — Disclosure" },
      {
        name: "description",
        content: "Take or choose photos of defects in your home for analysis.",
      },
      { property: "og:title", content: "Add photos — Disclosure" },
      {
        property: "og:description",
        content: "Take or choose photos of defects in your home for analysis.",
      },
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
      step={1}
      title="Add your photos"
      lead="One photo per problem."
      footer={
        analyzing ? (
          <div aria-live="polite">
            <p className="mb-2 font-semibold">
              Looking at photo {current} of {total}
            </p>
            <Progress
              value={(done / total) * 100}
              aria-label={`Looking at photo ${current} of ${total}`}
            />
          </div>
        ) : total > 0 && !busy ? (
          <Button asChild size="xl">
            <Link to="/findings">See what we found</Link>
          </Button>
        ) : (
          <Button
            size="xl"
            disabled={total === 0}
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
        capture="environment"
        multiple
        className="sr-only"
        id="photo-input"
        onChange={(e) => onFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-secondary px-4 py-8 text-center transition-colors hover:border-primary hover:bg-accent"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Camera className="size-7" aria-hidden />
        </span>
        <span className="text-lg font-semibold">
          {total ? "Add another photo" : "Take or choose a photo"}
        </span>
        <span className="text-sm text-muted-foreground">On a phone this opens the camera</span>
      </button>

      {nudge && (
        <p
          className="mt-4 border-l-4 border-primary bg-accent py-2.5 pl-3 pr-3 text-accent-foreground"
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
                  className={`aspect-square w-full rounded-lg object-cover ${p.status === "done" ? "" : "brightness-90"}`}
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
