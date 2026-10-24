import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GRADING_RULE } from "@/lib/disclosure/grading";
import { DISCLAIMER, deleteSession, useSession } from "@/lib/disclosure/store";

export function AppShell({ title, children, footer }: { title?: string; children: ReactNode; footer?: ReactNode }) {
  const [info, setInfo] = useState(false);
  const session = useSession();
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-background shadow-sm">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-2">
        <Link to="/" className="flex min-h-11 items-center text-lg font-bold tracking-tight text-primary">
          Disclosure
        </Link>
        <Button variant="ghost" size="touch" onClick={() => setInfo(true)} aria-label="How this works">
          <Info aria-hidden /> <span className="text-sm">How it works</span>
        </Button>
      </header>
      <main className="flex-1 px-5 py-6">
        {title && <h1 className="mb-4 text-2xl font-bold">{title}</h1>}
        {children}
      </main>
      {footer && <div className="sticky bottom-0 border-t bg-background px-5 py-4">{footer}</div>}

      <Sheet open={info} onOpenChange={setInfo}>
        <SheetContent side="bottom" className="mx-auto max-h-[85vh] max-w-[430px] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-xl">How this works</SheetTitle>
            <SheetDescription>{DISCLAIMER}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6 text-base">
            <section>
              <h2 className="font-semibold">Grading</h2>
              <p className="text-muted-foreground">
                Each finding gets a risk score = severity (1–5) × urgency (immediate 4, 30 days 3, 1 year 2, cosmetic
                1). Risk 1–3 is A, 4–6 B, 7–10 C, 11–15 D, 16–20 F. High confidence shows one letter; medium shows a
                range; low shows no grade.
              </p>
              <p className="mt-2 font-medium">{GRADING_RULE}</p>
            </section>
            <section>
              <h2 className="font-semibold">Privacy</h2>
              <p className="text-muted-foreground">
                Photos are resized and stripped of location and device data before analysis. Your session stays on
                this device. No accounts, no analytics.
              </p>
            </section>
            <section>
              <h2 className="font-semibold">Costs</h2>
              <p className="text-muted-foreground">
                Cost ranges come from a fixed table, never from the AI. They are placeholders and vary by region and
                contractor.
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
  return <p className="rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">{DISCLAIMER}</p>;
}

export function NoSession() {
  return (
    <AppShell title="No report yet">
      <p className="mb-6 text-muted-foreground">Start a report to add photos.</p>
      <Button asChild size="xl">
        <Link to="/">Go to start</Link>
      </Button>
    </AppShell>
  );
}
