import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell, Disclaimer } from "@/components/disclosure/AppShell";
import { GradeTile } from "@/components/disclosure/GradeBadge";
import { startSession, useSession } from "@/lib/disclosure/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Disclosure — photo-based home defect report" },
      {
        name: "description",
        content:
          "Photograph defects in your home and get a graded, organized disclosure companion report.",
      },
      { property: "og:title", content: "Disclosure — photo-based home defect report" },
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
      <div className="absolute inset-0 bg-gradient-to-b from-transparent from-45% to-foreground/55" />
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
  ["Photograph", "Each stain, crack or exposed wire."],
  ["Confirm", "Keep, fix or delete every finding."],
  ["Download", "A report by Maryland form section."],
] as const;

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
            <Lock className="size-3.5" aria-hidden /> Analyzed on this device. Nothing uploaded. No
            account.
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

      <ol className="mt-6 grid grid-cols-3 gap-2.5">
        {HOW.map(([t, d], i) => (
          <li
            key={t}
            style={{ "--d": `${0.3 + i * 0.08}s` } as CSSProperties}
            className="rise rounded-2xl border bg-card p-3 shadow-[var(--shadow-card)]"
          >
            <span className="text-xs font-extrabold text-primary">{i + 1}</span>
            <h2 className="mt-1 text-[0.95rem] font-bold leading-tight">{t}</h2>
            <p className="mt-1 text-[0.8rem] leading-snug text-muted-foreground">{d}</p>
          </li>
        ))}
      </ol>
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
