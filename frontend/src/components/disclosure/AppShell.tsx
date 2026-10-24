import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
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
import { GRADE_FILL, GRADE_INK } from "./RiskViz";
import { DISCLAIMER, deleteSession, useSession } from "@/lib/disclosure/store";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path
        d="M6.5 15.5 16 7l9.5 8.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 14v10h13V14"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="m13 19 2.4 2.4L20 16.8"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
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
    <nav aria-label="Progress" className="border-b bg-background px-5 pb-3 pt-1">
      <ol className="flex items-center">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "todo";
          return (
            <li key={s.to} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
              <Link
                to={s.to}
                aria-current={state === "current" ? "step" : undefined}
                className="flex items-center gap-1.5 rounded-full py-1 text-sm"
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                    state === "done" && "bg-primary text-primary-foreground",
                    state === "current" && "bg-foreground text-background",
                    state === "todo" && "bg-muted text-muted-foreground",
                  )}
                >
                  {state === "done" ? <Check className="size-3.5" aria-hidden /> : n}
                </span>
                <span
                  className={cn(
                    state === "current" ? "font-semibold" : "text-muted-foreground",
                    state !== "current" && "max-[380px]:hidden",
                  )}
                >
                  {s.label}
                </span>
              </Link>
              {i < STEPS.length - 1 && (
                <span
                  className={cn("mx-2 h-px flex-1", n < current ? "bg-primary" : "bg-border")}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
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
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-background shadow-[0_0_0_1px_var(--border),0_12px_40px_-12px_oklch(0.25_0.05_255/0.18)]">
      <div className="sticky top-0 z-10 bg-background">
        <header className="flex items-center justify-between px-5 py-2">
          <Link
            to="/"
            className="flex min-h-11 items-center gap-2 text-lg font-extrabold tracking-tight"
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
        {!(step && session) && <div className="border-b" />}
      </div>
      <main className="flex-1 px-5 pb-8 pt-6">
        {title && (
          <div className="mb-5">
            <h1 className="text-[1.75rem] font-extrabold leading-tight">{title}</h1>
            {lead && <p className="mt-1.5 text-base text-muted-foreground">{lead}</p>}
          </div>
        )}
        {children}
      </main>
      {footer && (
        <div className="sticky bottom-0 border-t bg-background/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
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
              <ul className="my-3 divide-y overflow-hidden rounded-lg border">
                {(
                  [
                    ["A", "1 to 3", "Minor"],
                    ["B", "4 to 6", "Low concern"],
                    ["C", "7 to 10", "Moderate"],
                    ["D", "11 to 15", "Serious"],
                    ["F", "16 to 20", "Urgent"],
                  ] as const
                ).map(([l, r, w]) => (
                  <li key={l} className="flex items-center gap-3 py-1.5 pl-1.5 pr-3 text-sm">
                    <span
                      className="flex size-7 items-center justify-center rounded font-extrabold"
                      style={{ background: GRADE_FILL[l], color: GRADE_INK[l] }}
                    >
                      {l}
                    </span>
                    <span className="font-medium">{w}</span>
                    <span className="ml-auto tabular-nums text-muted-foreground">score {r}</span>
                  </li>
                ))}
              </ul>
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
                session stays on this device. No accounts, no analytics.
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
    <p className="flex gap-2.5 border-l-4 border-primary bg-secondary py-2.5 pl-3 pr-3 text-sm text-secondary-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
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
