import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AppShell, Disclaimer, NoSession } from "@/components/disclosure/AppShell";
import { GradeBadge } from "@/components/disclosure/GradeBadge";
import { CostBar, GradeMix, GradeScale, OverallGrade } from "@/components/disclosure/RiskViz";
import { formatCost } from "@/lib/disclosure/costs";
import { GRADING_RULE, needsPro, worstEnd, type Letter } from "@/lib/disclosure/grading";
import { buildReport, totalCost } from "@/lib/disclosure/report";
import { useSession } from "@/lib/disclosure/store";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review — Disclosure" },
      {
        name: "description",
        content: "Overall grade and confirmed findings grouped by Maryland disclosure section.",
      },
      { property: "og:title", content: "Review — Disclosure" },
      {
        property: "og:description",
        content: "Overall grade and confirmed findings grouped by Maryland disclosure section.",
      },
    ],
  }),
  component: Review,
});

function Review() {
  const session = useSession();
  if (!session) return <NoSession />;
  const { sections, overall, items } = buildReport(session);
  const total = totalCost(items);
  const counts: Partial<Record<Letter, number>> = {};
  for (const it of items)
    if (it.range) counts[worstEnd(it.range)] = (counts[worstEnd(it.range)] ?? 0) + 1;
  const needsLook = items.filter((it) => needsPro(it.range)).length;
  return (
    <AppShell
      step={3}
      title="Your report at a glance"
      lead={session.address || undefined}
      footer={
        items.length ? (
          <Button asChild size="xl">
            <Link to="/report">Create the PDF</Link>
          </Button>
        ) : (
          <div className="space-y-2">
            <Button
              size="xl"
              disabled
              className="opacity-100 bg-muted text-muted-foreground shadow-none"
            >
              Create the PDF
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Confirm at least one finding first.
            </p>
          </div>
        )
      }
    >
      <section
        className="rounded-3xl border bg-card px-5 pb-5 pt-6 shadow-[var(--shadow-card)]"
        aria-labelledby="overall"
      >
        <h2 id="overall" className="mb-1 text-center text-sm font-bold text-muted-foreground">
          Overall grade
        </h2>
        <OverallGrade letter={overall} />
        <p className="mt-3 text-center text-sm text-muted-foreground">{GRADING_RULE}</p>
      </section>

      {items.length === 0 && (
        <p className="mt-6">
          You haven't confirmed any findings.{" "}
          <Link to="/findings" className="font-semibold text-primary underline">
            Go back and confirm some
          </Link>
          .
        </p>
      )}

      {items.length > 0 && (
        <section className="mt-6 space-y-5" aria-label="Summary">
          <div>
            <h2 className="mb-2 text-lg font-bold">
              {items.length} {items.length === 1 ? "finding" : "findings"}
              {needsLook ? `, ${needsLook} to have looked at` : ""}
            </h2>
            <GradeMix counts={counts} />
          </div>
          {total && (
            <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
              <p className="text-sm text-muted-foreground">Estimated repairs, all findings</p>
              <p className="text-2xl font-extrabold tabular-nums">{formatCost(total)}</p>
              <div className="mt-2">
                <CostBar low={total.low} high={total.high} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Placeholder ranges. Varies by region and contractor.
              </p>
            </div>
          )}
        </section>
      )}

      {sections.map(([section, list]) => (
        <section key={section} className="mt-8">
          <h2 className="mb-2 text-lg font-extrabold">{section}</h2>
          <ul className="divide-y rounded-3xl border bg-card px-3.5 shadow-[var(--shadow-card)]">
            {list.map((it) => (
              <li key={it.photo.id} className="flex gap-3 py-4">
                <img
                  src={it.photo.dataUrl}
                  alt={it.info.label}
                  className="size-20 shrink-0 rounded-2xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug">{it.info.label}</p>
                    <GradeBadge range={it.range} />
                  </div>
                  <div className="mt-2">
                    <GradeScale range={it.range} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                    {formatCost(it.cost)}
                  </p>
                  {needsPro(it.range) && (
                    <p className="mt-1 text-sm font-medium text-grade-f">
                      Have a licensed {it.info.pro.toLowerCase()} take a look.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="mt-8">
        <Disclaimer />
      </div>
    </AppShell>
  );
}
