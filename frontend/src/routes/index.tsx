import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { Camera, ChevronDown, ClipboardCheck, FileDown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell, Disclaimer } from "@/components/disclosure/AppShell";
import { GradeTile } from "@/components/disclosure/GradeBadge";
import { startSession, useSession } from "@/lib/disclosure/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Disclosure: photo-based home defect report" },
      {
        name: "description",
        content:
          "Photograph defects in your home and get a graded, organized disclosure companion report.",
      },
      { property: "og:title", content: "Disclosure: photo-based home defect report" },
      {
        property: "og:description",
        content:
          "Photograph defects in your home and get a graded, organized disclosure companion report.",
      },
    ],
  }),
  component: Welcome,
});

function Chip({
  letter,
  title,
  note,
  className,
  delay,
}: {
  letter: "A" | "B" | "C" | "D" | "F";
  title: string;
  note: string;
  className: string;
  delay: string;
}) {
  return (
    <div
      style={{ "--d": delay } as CSSProperties}
      className={`pop absolute flex items-center gap-2.5 rounded-2xl bg-card py-2 pl-2 pr-3.5 text-sm font-bold shadow-[0_8px_20px_-6px_oklch(0.2_0.05_258/0.45)] ${className}`}
    >
      <GradeTile letter={letter} />
      <span className="leading-tight">
        {title}
        <span className="block text-xs font-medium text-muted-foreground">{note}</span>
      </span>
    </div>
  );
}

function Hero() {
  return (
    <div className="relative h-60 overflow-hidden rounded-3xl bg-muted">
      <img
        src="/hero-roof.jpg"
        alt="Worn asphalt roof shingles photographed up close"
        className="size-full object-cover"
        width={900}
        height={675}
        fetchPriority="high"
      />
      <Chip letter="B" title="Roof" note="Worn shingles" className="left-4 top-4" delay="0.45s" />
      <Chip
        letter="C"
        title="Water intrusion"
        note="Ceiling stain"
        className="bottom-4 right-4"
        delay="0.65s"
      />
    </div>
  );
}

const HOW = [
  { icon: Camera, title: "Photo" },
  { icon: ClipboardCheck, title: "Analysis" },
  { icon: FileDown, title: "Report" },
] as const;

function StepFlow() {
  return (
    <ol aria-label="How it works" className="mt-7">
      {HOW.map(({ icon: Icon, title }, i) => {
        const last = i === HOW.length - 1;
        return (
          <li
            key={title}
            style={{ "--d": `${0.3 + i * 0.1}s` } as CSSProperties}
            className="rise relative flex gap-4 pb-6 last:pb-0"
          >
            {!last && (
              <span
                className="absolute left-[1.375rem] top-12 bottom-1 w-0.5 -translate-x-1/2 bg-border"
                aria-hidden
              >
                <ChevronDown className="absolute -bottom-1 left-1/2 size-5 -translate-x-1/2 bg-canvas text-muted-foreground" />
              </span>
            )}
            <span
              className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
              aria-hidden
            >
              <Icon className="size-5" />
            </span>
            <div className="flex min-h-11 min-w-0 items-center">
              <h2 className="text-lg font-bold leading-tight">
                <span className="text-primary">{i + 1}.</span> {title}
              </h2>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Welcome() {
  const session = useSession();
  const navigate = useNavigate();

  return (
    <AppShell
      footer={
        <div>
          <Button type="submit" form="start-form" size="xl">
            Start your report
          </Button>
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[0.8rem] font-medium text-muted-foreground">
            <Lock className="size-3.5" aria-hidden /> Analyzed on this device. Nothing leaves it
            unless you email your report. No account.
          </p>
        </div>
      }
    >
      <Hero />
      <h1 className="rise mt-6 text-[2.15rem] font-extrabold leading-[1.04] tracking-[-0.035em]">
        Put your home's known problems on the record
      </h1>
      <p className="mt-3 text-[1.05rem] leading-relaxed text-muted-foreground">
        Photograph what you know is wrong. Disclosure sorts each photo, grades how serious it is,
        and builds a report you can attach to your Maryland disclosure.
      </p>

      <StepFlow />
      <p className="mt-4 text-sm">
        <Link to="/about" className="font-semibold text-primary underline underline-offset-4">
          How grading works
        </Link>
      </p>

      <form
        id="start-form"
        onSubmit={(e) => {
          e.preventDefault();
          startSession("");
          navigate({ to: "/capture" });
        }}
      />
      {session && (
        <Button asChild variant="outline" size="xl" className="mt-8">
          <Link to="/capture">
            Pick up where you left off ({session.photos.length}{" "}
            {session.photos.length === 1 ? "photo" : "photos"})
          </Link>
        </Button>
      )}
      <div className="mt-6">
        <Disclaimer />
      </div>
    </AppShell>
  );
}
