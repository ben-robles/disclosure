import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, Disclaimer } from "@/components/disclosure/AppShell";
import { GradeLegend } from "@/components/disclosure/RiskViz";
import { GRADING_RULE } from "@/lib/disclosure/grading";
import { TEAM } from "@/lib/disclosure/site";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About | Disclosure" },
      {
        name: "description",
        content: "Who Disclosure is for, how it grades defects, and who built it.",
      },
      { property: "og:title", content: "About | Disclosure" },
      {
        property: "og:description",
        content: "Who Disclosure is for, how it grades defects, and who built it.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <AppShell
      title="About Disclosure"
      lead="A seller-side tool for documenting what you already know is wrong with your home."
    >
      <div className="space-y-4 text-base leading-relaxed">
        <p>
          Selling a home means telling the buyer about problems you know of. Most sellers have no
          easy way to document them. Disclosure turns phone photos into an organized report that
          follows the sections of the seller disclosure form.
        </p>
        <p>
          The AI that looks at your photos runs on your own computer. Nothing is uploaded unless you
          choose to email yourself your report, and there are no accounts.
        </p>
      </div>

      <h2 className="mt-8 text-xl font-bold">How grading works</h2>
      <p className="mt-2 text-muted-foreground">
        Every finding gets a score: severity (1 to 5) times urgency (cosmetic 1, within a year 2,
        within 30 days 3, immediately 4). The score sets the letter.
      </p>
      <div className="my-4">
        <GradeLegend />
      </div>
      <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
        <li>
          When the AI is very sure, you see one letter. When it's fairly sure, you see two. When it
          isn't sure enough, you see no grade.
        </li>
        <li>{GRADING_RULE}</li>
        <li>
          Repair costs come from a fixed table, never from the AI. They are placeholders and vary by
          region and contractor.
        </li>
        <li>Nothing goes in the report until you confirm it.</li>
      </ul>

      <h2 className="mt-8 text-xl font-bold">Who built it</h2>
      <ul className="mt-3 divide-y border-y">
        {TEAM.map((m) => (
          <li key={m.name} className="flex items-baseline justify-between gap-4 py-3">
            <span className="font-semibold">{m.name}</span>
            <span className="text-muted-foreground">{m.role}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-muted-foreground">
        Want to reach us?{" "}
        <Link to="/contact" className="font-semibold text-primary underline">
          Get in touch
        </Link>
        .
      </p>
      <div className="mt-8">
        <Disclaimer />
      </div>
    </AppShell>
  );
}
