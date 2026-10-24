import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Disclaimer } from "@/components/disclosure/AppShell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of use | Disclosure" },
      { name: "description", content: "What Disclosure is and is not." },
      { property: "og:title", content: "Terms of use | Disclosure" },
      { property: "og:description", content: "What Disclosure is and is not." },
    ],
  }),
  component: Terms,
});

const SECTIONS: [string, string][] = [
  [
    "What this is",
    "Disclosure is an AI-assisted documentation aid. It is not a home inspection, an appraisal or legal advice.",
  ],
  [
    "Your responsibility",
    "You decide what goes in your report and what you disclose to a buyer. Check the report against Maryland's disclosure requirements, and ask a licensed professional if you're unsure.",
  ],
  [
    "AI can be wrong",
    "Findings, grades and defect types come from an AI model and may be incorrect or incomplete. Review every finding before you confirm it.",
  ],
  [
    "Repair costs are placeholders",
    "Cost ranges come from a fixed table and vary by region, contractor and the real condition of the problem.",
  ],
  ["Quote requests are a demo", "The Get a quote and Request quote buttons don't contact anyone."],
  ["No warranty", "Disclosure is provided as is, without warranties of any kind."],
];

function Terms() {
  return (
    <AppShell title="Terms of use">
      <Disclaimer />
      <div className="mt-6 space-y-6">
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
