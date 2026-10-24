import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell, Disclaimer } from "@/components/disclosure/AppShell";
import { startSession, useSession } from "@/lib/disclosure/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Disclosure — photo-based home defect report" },
      { name: "description", content: "Photograph defects in your home and get a graded, organized disclosure companion report." },
      { property: "og:title", content: "Disclosure — photo-based home defect report" },
      { property: "og:description", content: "Photograph defects in your home and get a graded, organized disclosure companion report." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const [zip, setZip] = useState("");
  const [address, setAddress] = useState("");
  const [sellerName, setSellerName] = useState("");
  const session = useSession();
  const navigate = useNavigate();
  const zipValid = zip === "" || /^\d{5}$/.test(zip);

  return (
    <AppShell title="Document your home's defects">
      <p className="mb-6 text-lg leading-relaxed text-muted-foreground">
        Selling a home? Photograph problems like stains, cracks or exposed wiring. Each photo is sorted into a defect
        type and graded, with a typical cost range. You review everything before it goes into a report organized by
        Maryland disclosure sections.
      </p>
      <Disclaimer />
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!zipValid) return;
          startSession(zip, { address: address.trim(), sellerName: sellerName.trim() });
          navigate({ to: "/capture" });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="seller" className="text-base">Seller name (optional)</Label>
          <Input id="seller" autoComplete="name" value={sellerName} onChange={(e) => setSellerName(e.target.value)} className="h-12 text-lg" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address" className="text-base">Property address (optional)</Label>
          <Input id="address" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} className="h-12 text-lg" />
          <p className="text-sm text-muted-foreground">Printed on the report header.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip" className="text-base">ZIP code (optional)</Label>
          <Input
            id="zip"
            inputMode="numeric"
            maxLength={5}
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
            className="h-12 text-lg"
            aria-invalid={!zipValid}
            aria-describedby="zip-help"
          />
          <p id="zip-help" className="text-sm text-muted-foreground">Printed on the report. 5 digits.</p>
        </div>
        <Button type="submit" size="xl" disabled={!zipValid}>Start a report</Button>
        {session && (
          <Button asChild variant="outline" size="xl">
            <Link to="/capture">Continue current report ({session.photos.length} photos)</Link>
          </Button>
        )}
      </form>
    </AppShell>
  );
}
