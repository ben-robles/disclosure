import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/disclosure/AppShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy | Disclosure" },
      { name: "description", content: "What happens to your photos and details." },
      { property: "og:title", content: "Privacy | Disclosure" },
      { property: "og:description", content: "What happens to your photos and details." },
    ],
  }),
  component: Privacy,
});

const SECTIONS: [string, string][] = [
  [
    "Where your photos are analyzed",
    "Your photos are stripped of location and device data on this computer, then sent over an encrypted connection to our AI server on Google Cloud, which looks at them and sends back a finding. The server does not keep your photos. Everything else stays on this computer until you choose to email yourself the report.",
  ],
  [
    "Location and device data are removed",
    "Before analysis, each photo is resized and rebuilt from its pixels only. GPS, timestamps and device details are dropped.",
  ],
  [
    "Where your report lives",
    "Your photos, findings and details are stored in this browser and in a local database on this computer. We don't have copies.",
  ],
  [
    "Emailing your report (optional)",
    "If you ask us to email your report, the PDF and your address are sent to our mail server once, forwarded to you, and not saved. The PDF includes your photos. Skip it and only the analysis request leaves this computer.",
  ],
  [
    "No accounts, no tracking",
    "There's nothing to sign up for, and we don't use analytics or advertising.",
  ],
  [
    "Deleting everything",
    "Open How it works and choose Delete this session. Your photos and findings are removed.",
  ],
  [
    "The contact form",
    "The form on the Contact page is a demo. It doesn't send your message anywhere.",
  ],
];

function Privacy() {
  return (
    <AppShell title="Privacy" lead="In short: your photos stay with you.">
      <div className="space-y-6">
        {SECTIONS.map(([h, p]) => (
          <section key={h}>
            <h2 className="text-lg font-bold">{h}</h2>
            <p className="mt-1 text-muted-foreground">{p}</p>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
