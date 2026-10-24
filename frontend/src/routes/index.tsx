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
      {
        name: "description",
        content:
          "Photograph defects in your home and get a graded, organized disclosure companion report.",
      },
      { property: "og:title", content: "Disclosure — photo-based home defect report" },
      {
        property: "og:description",
        content:
          "Photograph defects in your home and get a graded, organized disclosure companion report.",
      },
    ],
  }),
  component: Welcome,
});

function HouseHero() {
  return (
    <svg
      viewBox="0 0 360 210"
      className="w-full"
      role="img"
      aria-label="A house with three pins marking a roof, a window and a foundation problem"
    >
      <rect width="360" height="210" rx="14" fill="var(--secondary)" />
      <path d="M0 176h360v22a12 12 0 0 1-12 12H12A12 12 0 0 1 0 198z" fill="oklch(0.88 0.04 150)" />
      <rect x="0" y="170" width="360" height="8" fill="oklch(0.8 0.05 150)" />
      {/* house */}
      <path
        d="M92 172V96h176v76z"
        fill="#fff"
        stroke="var(--foreground)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M78 100 180 34l102 66z"
        fill="oklch(0.42 0.07 255)"
        stroke="var(--foreground)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect
        x="236"
        y="48"
        width="16"
        height="30"
        fill="oklch(0.55 0.08 40)"
        stroke="var(--foreground)"
        strokeWidth="2.5"
      />
      <rect
        x="112"
        y="116"
        width="42"
        height="34"
        rx="2"
        fill="oklch(0.9 0.04 230)"
        stroke="var(--foreground)"
        strokeWidth="2.5"
      />
      <path d="M133 116v34M112 133h42" stroke="var(--foreground)" strokeWidth="2" />
      <rect
        x="164"
        y="124"
        width="36"
        height="48"
        rx="2"
        fill="oklch(0.55 0.08 40)"
        stroke="var(--foreground)"
        strokeWidth="2.5"
      />
      <circle cx="193" cy="150" r="2.2" fill="#fff" />
      <rect
        x="210"
        y="116"
        width="42"
        height="34"
        rx="2"
        fill="oklch(0.9 0.04 230)"
        stroke="var(--foreground)"
        strokeWidth="2.5"
      />
      <path d="M231 116v34M210 133h42" stroke="var(--foreground)" strokeWidth="2" />
      {/* a hairline crack at the foundation */}
      <path
        d="M118 172l5-6 -3-5 6-5"
        fill="none"
        stroke="var(--grade-f)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* pins */}
      <g>
        <circle cx="160" cy="76" r="13" fill="var(--grade-a)" stroke="#fff" strokeWidth="3" />
        <text x="160" y="81" fontSize="13" fontWeight="800" fill="#fff" textAnchor="middle">
          A
        </text>
      </g>
      <g>
        <circle cx="224" cy="108" r="13" fill="var(--grade-c)" stroke="#fff" strokeWidth="3" />
        <text x="224" y="113" fontSize="13" fontWeight="800" fill="#2b1d00" textAnchor="middle">
          C
        </text>
      </g>
      <g>
        <circle cx="124" cy="158" r="13" fill="var(--grade-f)" stroke="#fff" strokeWidth="3" />
        <text x="124" y="163" fontSize="13" fontWeight="800" fill="#fff" textAnchor="middle">
          F
        </text>
      </g>
    </svg>
  );
}

const HOW = [
  ["Take photos", "Snap each stain, crack or exposed wire. Add a second angle if you can."],
  [
    "Check what we found",
    "Every photo gets a defect type, a grade and a typical repair cost. Confirm, fix or delete each one.",
  ],
  [
    "Download your report",
    "Confirmed findings are grouped by the sections of the Maryland disclosure form.",
  ],
] as const;

function Welcome() {
  const [zip, setZip] = useState("");
  const [address, setAddress] = useState("");
  const [sellerName, setSellerName] = useState("");
  const session = useSession();
  const navigate = useNavigate();
  const zipValid = zip === "" || /^\d{5}$/.test(zip);

  return (
    <AppShell>
      <HouseHero />
      <h1 className="mt-6 text-[2rem] font-extrabold leading-[1.1]">
        Put your home's known problems on the record
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
        Photograph what you know is wrong. Disclosure sorts each photo, grades how serious it is,
        and builds a report you can attach to your Maryland disclosure.
      </p>

      <ol className="mt-7 divide-y border-y">
        {HOW.map(([t, d], i) => (
          <li key={t} className="flex gap-4 py-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
              {i + 1}
            </span>
            <div>
              <h2 className="font-semibold">{t}</h2>
              <p className="text-base text-muted-foreground">{d}</p>
            </div>
          </li>
        ))}
      </ol>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!zipValid) return;
          startSession(zip, { address: address.trim(), sellerName: sellerName.trim() });
          navigate({ to: "/capture" });
        }}
      >
        <h2 className="text-xl font-bold">About the property</h2>
        <div className="space-y-1.5">
          <Label htmlFor="seller" className="text-base">
            Your name <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="seller"
            autoComplete="name"
            value={sellerName}
            onChange={(e) => setSellerName(e.target.value)}
            className="h-12 bg-background text-lg"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address" className="text-base">
            Street address <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="address"
            autoComplete="street-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="h-12 bg-background text-lg"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zip" className="text-base">
            ZIP code <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="zip"
            inputMode="numeric"
            maxLength={5}
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
            className="h-12 bg-background text-lg"
            aria-invalid={!zipValid}
            aria-describedby={zipValid ? undefined : "zip-help"}
          />
          {!zipValid && (
            <p id="zip-help" className="text-sm font-medium text-destructive">
              Enter all 5 digits, or leave it blank.
            </p>
          )}
        </div>
        <Button type="submit" size="xl" disabled={!zipValid}>
          Start your report
        </Button>
        {session && (
          <Button asChild variant="outline" size="xl">
            <Link to="/capture">
              Pick up where you left off ({session.photos.length}{" "}
              {session.photos.length === 1 ? "photo" : "photos"})
            </Link>
          </Button>
        )}
      </form>
      <div className="mt-6">
        <Disclaimer />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Photos are analyzed on this computer. Nothing is uploaded, and there's no account to make.
      </p>
    </AppShell>
  );
}
