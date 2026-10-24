import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail } from "lucide-react";
import { AppShell } from "@/components/disclosure/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EMAIL, GITHUB_URL } from "@/lib/disclosure/site";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Disclosure" },
      { name: "description", content: "Email the Disclosure team or send a message." },
      { property: "og:title", content: "Contact — Disclosure" },
      { property: "og:description", content: "Email the Disclosure team or send a message." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const [sent, setSent] = useState(false);
  return (
    <AppShell title="Contact us" lead="Questions, feedback or a bug? We'd like to hear it.">
      <ul className="space-y-1">
        <li>
          <a
            href={`mailto:${EMAIL}`}
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline"
          >
            <Mail className="size-4" aria-hidden /> {EMAIL}
          </a>
        </li>
        <li>
          <a
            href={GITHUB_URL}
            className="inline-flex min-h-11 items-center font-semibold text-primary underline"
          >
            Report an issue on GitHub
          </a>
        </li>
      </ul>

      <div aria-live="polite" className="mt-6">
        {sent ? (
          <div className="border-l-4 border-primary bg-secondary p-4">
            <p className="font-semibold">Message received (demo)</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing was sent. Email us at {EMAIL} to reach the team.
            </p>
            <Button variant="outline" size="touch" className="mt-3" onClick={() => setSent(false)}>
              Write another
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <h2 className="text-xl font-bold">Send a message</h2>
            <div className="space-y-1.5">
              <Label htmlFor="c-name" className="text-base">
                Your name
              </Label>
              <Input
                id="c-name"
                required
                autoComplete="name"
                className="h-12 bg-background text-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email" className="text-base">
                Email
              </Label>
              <Input
                id="c-email"
                type="email"
                required
                autoComplete="email"
                className="h-12 bg-background text-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-msg" className="text-base">
                Message
              </Label>
              <Textarea id="c-msg" required rows={5} className="bg-background text-lg" />
            </div>
            <Button type="submit" size="xl">
              Send message
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
