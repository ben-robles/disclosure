import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/disclosure/AppShell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Disclosure" },
      { name: "description", content: "Answers about photos, grading, accuracy and privacy." },
      { property: "og:title", content: "FAQ — Disclosure" },
      {
        property: "og:description",
        content: "Answers about photos, grading, accuracy and privacy.",
      },
    ],
  }),
  component: Faq,
});

const QUESTIONS: [string, string][] = [
  [
    "Is this a home inspection?",
    "No. Disclosure is a documentation aid. It sorts photos you take into defect types and grades them. A licensed home inspector can look at things a photo can't show.",
  ],
  [
    "Where do my photos go?",
    "Your photos are stripped of location and device data on this computer, then sent over an encrypted connection to our AI server on Google Cloud, which looks at them and sends back a finding. The server does not keep your photos. Everything else stays on this computer until you choose to email yourself the report.",
  ],
  [
    "How accurate is it?",
    "It's a first pass. That's why you confirm, edit or delete every finding, and why a low-confidence photo gets no grade at all. If a finding looks wrong, change it.",
  ],
  [
    "Why do some grades show two letters?",
    "Two letters mean the AI was only fairly sure. The range is the letter it picked and the next worse one. The overall grade always uses the worse end.",
  ],
  [
    "Where do the repair costs come from?",
    "A fixed table by defect type and severity. The AI never writes a dollar amount. The numbers are placeholders for the DC, Maryland and Virginia area.",
  ],
  [
    "Is it only for Maryland?",
    "For now, yes. The report follows the sections of Maryland's seller disclosure form.",
  ],
  ["Do I need an account?", "No accounts, no payments and no analytics."],
  [
    "Why can't it grade my photo?",
    "The photo may be blurry, may not show part of a home, or may not give the AI enough to go on. Retake it closer and in better light, or ask an inspector.",
  ],
];

function Faq() {
  return (
    <AppShell title="Questions, answered">
      <Accordion type="single" collapsible className="border-t">
        {QUESTIONS.map(([q, a], i) => (
          <AccordionItem key={q} value={`q${i}`}>
            <AccordionTrigger className="text-left text-base font-semibold">{q}</AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground">{a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <p className="mt-6 text-muted-foreground">
        Still stuck?{" "}
        <Link to="/contact" className="font-semibold text-primary underline">
          Send us a message
        </Link>
        .
      </p>
    </AppShell>
  );
}
