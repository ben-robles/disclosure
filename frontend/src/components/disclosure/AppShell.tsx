import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { GRADING_RULE } from "@/lib/disclosure/grading";
import { cn } from "@/lib/utils";
import { EMAIL, GITHUB_URL } from "@/lib/disclosure/site";
import { GradeLegend } from "./RiskViz";
import { DISCLAIMER, deleteSession, useSession } from "@/lib/disclosure/store";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="10" fill="var(--primary)" />
      <path
        d="M7 15 16 7.5 25 15v9.5H7z"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m12.2 16.6 2.8 2.8 5-5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STEPS = [
  { to: "/capture", label: "Photos" },
  { to: "/findings", label: "Findings" },
  { to: "/review", label: "Review" },
  { to: "/report", label: "Report" },
] as const;

function Steps({ current }: { current: number }) {
  return (
    <nav aria-label="Progress" className="px-5 pb-3 pt-1">
      <ol className="flex gap-1.5">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "todo";
          return (
            <li key={s.to} className="flex-1">
              <Link
                to={s.to}
                aria-current={state === "current" ? "step" : undefined}
                className="group flex min-h-9 flex-col justify-end gap-1.5"
              >
                <span
                  className={cn(
                    "text-xs font-semibold transition-colors",
                    state === "current" ? "text-foreground" : "text-muted-foreground",
                    state === "done" && "group-hover:text-foreground",
                  )}
                >
                  {state === "done" && (
                    <Check className="mr-0.5 inline size-3 -translate-y-px" aria-hidden />
                  )}
                  {s.label}
                </span>
                <span
                  className={cn(
                    "h-1.5 rounded-full transition-colors",
                    state === "todo" ? "bg-border" : "bg-primary",
                  )}
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const FOOTER_LINKS = [
  { to: "/about", label: "About" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted px-5 py-8 text-sm">
      <Link to="/" className="flex items-center gap-2 text-base font-extrabold tracking-tight">
        <Logo className="size-6" /> Disclosure
      </Link>
      <p className="mt-2 text-muted-foreground">
        Photo-based defect documentation for home sellers.
      </p>
      <nav aria-label="Site" className="mt-5">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
          {FOOTER_LINKS.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                className="inline-flex min-h-9 items-center font-medium hover:underline"
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <a
              href={GITHUB_URL}
              className="inline-flex min-h-9 items-center font-medium hover:underline"
            >
              GitHub
            </a>
          </li>
        </ul>
      </nav>
      <p className="mt-4">
        Questions?{" "}
        <a href={`mailto:${EMAIL}`} className="font-medium text-primary underline">
          {EMAIL}
        </a>
      </p>
      <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
        {DISCLAIMER} Built for the GDG AI for Housing challenge with Gemma 4. © 2026 Disclosure.
      </p>
    </footer>
  );
}

export function AppShell({
  title,
  lead,
  step,
  children,
  footer,
}: {
  title?: string;
  lead?: string | undefined;
  step?: 1 | 2 | 3 | 4;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [info, setInfo] = useState(false);
  const session = useSession();
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-canvas shadow-[0_0_0_1px_var(--border),0_20px_60px_-20px_oklch(0.25_0.05_258/0.3)]">
      <div className="sticky top-0 z-10 bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
        <header className="flex items-center justify-between px-5 py-2">
          <Link
            to="/"
            className="flex min-h-11 items-center gap-2.5 text-xl font-extrabold tracking-tight"
          >
            <Logo /> Disclosure
          </Link>
          <Button
            variant="ghost"
            size="touch"
            onClick={() => setInfo(true)}
            aria-label="How this works"
          >
            <Info aria-hidden /> <span className="text-sm">How it works</span>
          </Button>
        </header>
        {step && session && <Steps current={step} />}
        <div className="border-b" />
      </div>
      <main className="rise flex-1 px-5 pb-8 pt-6" style={{ "--d": "0.05s" } as CSSProperties}>
        {title && (
          <div className="mb-5">
            <h1 className="text-[2rem] font-extrabold leading-[1.08]">{title}</h1>
            {lead && <p className="mt-1.5 text-base text-muted-foreground">{lead}</p>}
          </div>
        )}
        {children}
      </main>
      <SiteFooter />
      {footer && (
        <div className="sticky bottom-0 z-10 border-t bg-canvas/95 px-4 pb-5 pt-3 backdrop-blur supports-[backdrop-filter]:bg-canvas/85">
          {footer}
        </div>
      )}

      <Sheet open={info} onOpenChange={setInfo}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[85vh] max-w-[430px] overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader>
            <SheetTitle className="text-xl">How this works</SheetTitle>
            <SheetDescription>{DISCLAIMER}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6 text-base">
            <section>
              <h2 className="font-semibold">Grading</h2>
              <p className="text-muted-foreground">
                Score = severity (1 to 5) × urgency (cosmetic 1, within a year 2, within 30 days 3,
                immediately 4).
              </p>
              <div className="my-3">
                <GradeLegend />
              </div>
              <p className="text-muted-foreground">
                When the AI is only fairly sure, you see two letters. When it isn't sure enough, you
                see no grade.
              </p>
              <p className="mt-2 font-medium">{GRADING_RULE}</p>
            </section>
            <section>
              <h2 className="font-semibold">Privacy</h2>
              <p className="text-muted-foreground">
                Photos are resized and stripped of location and device data before analysis. Your
                session stays on this device unless you email yourself your report. No accounts, no
                analytics.
              </p>
            </section>
            <section>
              <h2 className="font-semibold">Costs</h2>
              <p className="text-muted-foreground">
                Cost ranges come from a fixed table, never from the AI. They are placeholders and
                vary by region and contractor.
              </p>
            </section>
            {session && (
              <Button
                variant="destructive"
                size="xl"
                onClick={() => {
                  deleteSession();
                  setInfo(false);
                  navigate({ to: "/" });
                }}
              >
                Delete this session
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="flex gap-2.5 rounded-2xl bg-secondary p-3.5 text-sm leading-snug text-secondary-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      {DISCLAIMER}
    </p>
  );
}

export function NoSession() {
  return (
    <AppShell title="Nothing here yet">
      <p className="mb-6 text-muted-foreground">
        Start a report and your photos will show up here.
      </p>
      <Button asChild size="xl">
        <Link to="/">Start a report</Link>
      </Button>
    </AppShell>
  );
}
