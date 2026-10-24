import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AppShell, Disclaimer, NoSession } from "@/components/disclosure/AppShell";
import { GradeBadge } from "@/components/disclosure/GradeBadge";
import { formatCost } from "@/lib/disclosure/costs";
import { GRADING_RULE, needsPro } from "@/lib/disclosure/grading";
import { buildReport } from "@/lib/disclosure/report";
import { useSession } from "@/lib/disclosure/store";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review — Disclosure" },
      { name: "description", content: "Overall grade and confirmed findings grouped by Maryland disclosure section." },
      { property: "og:title", content: "Review — Disclosure" },
      { property: "og:description", content: "Overall grade and confirmed findings grouped by Maryland disclosure section." },
    ],
  }),
  component: Review,
});

function Review() {
  const session = useSession();
  if (!session) return <NoSession />;
  const { sections, overall, items } = buildReport(session);
  return (
    <AppShell
      title="Review"
      footer={
        items.length ? (
          <Button asChild size="xl"><Link to="/report">Generate PDF</Link></Button>
        ) : (
          <div className="space-y-2">
            <Button size="xl" disabled className="opacity-100 bg-muted text-muted-foreground shadow-none">Generate PDF</Button>
            <p className="text-center text-sm text-muted-foreground">Confirm at least one finding to generate a report.</p>
          </div>
        )
      }
    >
      <Disclaimer />
      <section className="mt-6 rounded-xl border p-5 text-center" aria-labelledby="overall">
        <h2 id="overall" className="mb-3 font-semibold text-muted-foreground">Overall grade</h2>
        <GradeBadge range={overall ? [overall] : null} large />
        <p className="mt-3 text-sm">{GRADING_RULE}</p>
      </section>
      {items.length === 0 && (
        <p className="mt-6">No confirmed findings yet. <Link to="/findings" className="font-semibold text-primary underline">Go back to findings</Link>.</p>
      )}
      {sections.map(([section, list]) => (
        <section key={section} className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">{section}</h2>
          <ul className="space-y-3">
            {list.map((it) => (
              <li key={it.photo.id} className="flex gap-3 rounded-xl border p-3">
                <img src={it.photo.dataUrl} alt={it.info.label} className="size-16 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0">
                  <p className="font-semibold">{it.info.label}</p>
                  <div className="my-1"><GradeBadge range={it.range} /></div>
                  <p className="text-sm text-muted-foreground">{formatCost(it.cost)}</p>
                  {needsPro(it.range) && <p className="text-sm font-medium">Recommend evaluation by a licensed {it.info.pro.toLowerCase()}.</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </AppShell>
  );
}
