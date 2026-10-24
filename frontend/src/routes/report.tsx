import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AppShell, NoSession } from "@/components/disclosure/AppShell";
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
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session) return;
    let u: string | null = null;
    generatePdf(session)
      .then((b) => {
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
      lead="Read it through, then download a copy."
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
          className="h-[65vh] w-full rounded-lg border bg-muted shadow-sm"
        />
      )}
    </AppShell>
  );
}
