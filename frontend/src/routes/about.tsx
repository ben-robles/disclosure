import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Disclaimer } from "@/components/disclosure/AppShell";
import { GradeLegend } from "@/components/disclosure/RiskViz";
import { GRADING_RULE } from "@/lib/disclosure/grading";
import { EMAIL } from "@/lib/disclosure/site";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About | Disclosure" },
      {
        name: "description",
        content: "Who Disclosure is for and how it grades defects.",
      },
      { property: "og:title", content: "About | Disclosure" },
      {
        property: "og:description",
        content: "Who Disclosure is for and how it grades defects.",
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
          Your photos are stripped of location and device data on this computer, then sent over an
          encrypted connection to our AI server on Google Cloud, which looks at them and sends back
          a finding. The server does not keep your photos. Everything else stays on this computer
          until you choose to email yourself the report. There are no accounts.
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

      <p className="mt-8 text-muted-foreground">
        Questions?{" "}
        <a href={`mailto:${EMAIL}`} className="font-semibold text-primary underline">
          {EMAIL}
        </a>
      </p>
      <div className="mt-8">
        <Disclaimer />
      </div>
    </AppShell>
  );
}
