import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell, NoSession } from "@/components/disclosure/AppShell";
import { emailReport } from "@/lib/disclosure/email";
import { generatePdf } from "@/lib/disclosure/report";
import { useSession } from "@/lib/disclosure/store";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report — Disclosure" },
      { name: "description", content: "View and download your defect documentation PDF." },
      { property: "og:title", content: "Report — Disclosure" },
      { property: "og:description", content: "View and download your defect documentation PDF." },
    ],
  }),
  component: Report,
});

function Report() {
  const session = useSession();
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session) return;
    let u: string | null = null;
    generatePdf(session)
      .then((b) => {
        setBlob(b);
        u = URL.createObjectURL(b);
        setUrl(u);
      })
      .catch(() => setError(true));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
    // regenerate only when session identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  if (!session) return <NoSession />;
  return (
    <AppShell
      step={4}
      title="Your report is ready"
      footer={
        <div className="grid gap-2">
          <Button asChild size="xl" disabled={!url}>
            <a
              href={url ?? undefined}
              download={`disclosure-report-${session.zip || new Date().toISOString().slice(0, 10)}.pdf`}
            >
              Download the PDF
            </a>
          </Button>
          <Button asChild variant="ghost" size="touch">
            <Link to="/review">Back to the summary</Link>
          </Button>
        </div>
      }
    >
      {error && (
        <p role="alert">We couldn't create the report. Go back to the summary and try again.</p>
      )}
      {!url && !error && (
        <p aria-live="polite" className="text-muted-foreground">
          Putting your report together…
        </p>
      )}
      {url && (
        <iframe
          src={url}
          title="Disclosure report PDF"
          className="h-[65vh] w-full border bg-muted shadow-[var(--shadow-card)]"
        />
      )}
      {blob && <EmailCard pdf={blob} />}
    </AppShell>
  );
}

function EmailCard({ pdf }: { pdf: Blob }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    const r = await emailReport(email, pdf);
    setState(r.ok ? "sent" : "error");
    setMessage(r.ok ? "" : r.message);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-5 rounded-3xl border bg-card p-4 shadow-[var(--shadow-card)]"
    >
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <Mail className="size-5 text-primary" aria-hidden /> Email me a copy
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Optional. We send the PDF once and don't keep your address or the report.
      </p>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="email" className="text-base">
          Email address
        </Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state !== "sending") setState("idle");
          }}
          className="h-12 rounded-xl bg-background text-lg"
          aria-invalid={state === "error"}
          aria-describedby="email-status"
        />
      </div>
      <Button
        type="submit"
        variant="outline"
        size="touch"
        className="mt-3 w-full"
        disabled={state === "sending" || !email}
      >
        {state === "sending" ? (
          <>
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> Sending…
          </>
        ) : (
          "Email my report"
        )}
      </Button>
      <p
        id="email-status"
        aria-live="polite"
        className={
          state === "error"
            ? "mt-3 rounded-2xl bg-destructive/10 p-3 text-sm font-medium text-destructive"
            : state === "sent"
              ? "pop mt-3 flex items-center gap-2 rounded-2xl bg-accent p-3 text-sm font-medium text-accent-foreground"
              : "sr-only"
        }
      >
        {state === "sent" && (
          <>
            <Check className="size-4 text-grade-a" aria-hidden /> Sent. Check your inbox in a
            minute.
          </>
        )}
        {state === "error" && message}
      </p>
    </form>
  );
}
