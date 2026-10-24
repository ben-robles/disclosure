import { cn } from "@/lib/utils";
import {
  LETTERS,
  LETTER_SCORES,
  LETTER_WORD,
  URGENCY_SCORE,
  letterFor,
  worstEnd,
  type Confidence,
  type Letter,
  type Urgency,
} from "@/lib/disclosure/grading";

/** Fill colour per letter, from the --grade-* tokens in styles.css. */
export const GRADE_FILL: Record<Letter, string> = {
  A: "var(--grade-a)",
  B: "var(--grade-b)",
  C: "var(--grade-c)",
  D: "var(--grade-d)",
  F: "var(--grade-f)",
};

/** Text colour that stays readable on each fill. */
export const GRADE_INK: Record<Letter, string> = {
  A: "#fff",
  B: "#1d2a00",
  C: "#2b1d00",
  D: "#2b1300",
  F: "#fff",
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
}

function arc(cx: number, cy: number, rOuter: number, rInner: number, from: number, to: number) {
  const [x1, y1] = polar(cx, cy, rOuter, from);
  const [x2, y2] = polar(cx, cy, rOuter, to);
  const [x3, y3] = polar(cx, cy, rInner, to);
  const [x4, y4] = polar(cx, cy, rInner, from);
  return `M${x1} ${y1} A${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${rInner} ${rInner} 0 0 0 ${x4} ${y4}Z`;
}

/**
 * Half-circle dial, A on the left through F on the right. Letters outside the
 * graded range are faded so a two-letter range reads as a wider lit span.
 */
export function GradeDial({ range, className }: { range: Letter[] | null; className?: string }) {
  const lit = new Set(range ?? []);
  const gap = 2;
  const seg = (180 - gap * 4) / 5;
  const needleLetter = range ? worstEnd(range) : null;
  let needleDeg = 270;
  if (needleLetter) {
    const i = LETTERS.indexOf(needleLetter);
    needleDeg = 180 + i * (seg + gap) + seg / 2;
  }
  const [nx, ny] = polar(120, 120, 74, needleDeg);
  return (
    <svg viewBox="0 0 240 142" className={cn("w-full", className)} role="presentation" aria-hidden>
      {LETTERS.map((l, i) => {
        const from = 180 + i * (seg + gap);
        const to = from + seg;
        const [lx, ly] = polar(120, 120, 87, (from + to) / 2);
        const on = !range || lit.has(l);
        return (
          <g key={l}>
            <path
              d={arc(120, 120, 108, 66, from, to)}
              fill={range ? GRADE_FILL[l] : "var(--muted)"}
              opacity={on ? 1 : 0.2}
            />
            {range && (
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="15"
                fontWeight="800"
                fill={GRADE_INK[l]}
                opacity={on ? 1 : 0.5}
              >
                {l}
              </text>
            )}
          </g>
        );
      })}
      {range && (
        <>
          <g
            className="sweep"
            style={{ "--sweep-from": `${180 - needleDeg}deg` } as React.CSSProperties}
          >
            <line
              x1="120"
              y1="120"
              x2={nx}
              y2={ny}
              stroke="var(--foreground)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
          <circle cx="120" cy="120" r="8" fill="var(--foreground)" />
          <circle cx="120" cy="120" r="3" fill="var(--background)" />
        </>
      )}
    </svg>
  );
}

/** Overall grade: dial with the letter and its plain-language word underneath. */
export function OverallGrade({ letter }: { letter: Letter | null }) {
  return (
    <div className="mx-auto w-full max-w-[280px] text-center">
      <GradeDial range={letter ? [letter] : null} />
      <div className="-mt-3">
        {letter ? (
          <>
            <p
              className="text-6xl font-extrabold leading-none"
              style={{ color: GRADE_FILL[letter] }}
            >
              {letter}
            </p>
            <p className="mt-1 text-base font-semibold">{LETTER_WORD[letter]}</p>
          </>
        ) : (
          <p className="text-lg font-semibold text-muted-foreground">No grade yet</p>
        )}
      </div>
    </div>
  );
}

/** Flat five-step bar: the quickest read of where one finding sits on A to F. */
export function GradeScale({ range }: { range: Letter[] | null }) {
  const lit = new Set(range ?? []);
  return (
    <div className="flex gap-0.5" aria-hidden>
      {LETTERS.map((l) => {
        const on = lit.has(l);
        return (
          <div
            key={l}
            className="flex h-5 flex-1 items-center justify-center text-[11px] font-bold first:rounded-l-full last:rounded-r-full"
            style={{
              background: on ? GRADE_FILL[l] : "var(--muted)",
              color: on ? GRADE_INK[l] : "var(--muted-foreground)",
              opacity: on || !range ? 1 : 0.7,
            }}
          >
            {l}
          </div>
        );
      })}
    </div>
  );
}

const URGENCY_COLS: Urgency[] = ["cosmetic", "1_year", "30_days", "immediate"];
const URGENCY_SHORT: Record<Urgency, string> = {
  cosmetic: "Cosmetic",
  "1_year": "1 yr",
  "30_days": "30 days",
  immediate: "Now",
};

/**
 * Severity x urgency grid. Every cell is coloured by the letter its score would
 * earn, so the highlighted cell shows exactly how the finding got its grade.
 */
export function RiskMatrix({ severity, urgency }: { severity: number; urgency: Urgency }) {
  const rows = [5, 4, 3, 2, 1];
  return (
    <figure
      className="m-0"
      aria-label={`Risk matrix: severity ${severity} of 5, ${URGENCY_SHORT[urgency]} urgency, score ${severity * URGENCY_SCORE[urgency]} of 20`}
    >
      <div className="grid grid-cols-[auto_repeat(4,minmax(0,1fr))] gap-[3px]" aria-hidden>
        {rows.map((s) => (
          <div key={s} className="contents">
            <span className="flex items-center pr-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {s}
            </span>
            {URGENCY_COLS.map((u) => {
              const l = letterFor(s * URGENCY_SCORE[u]);
              const here = s === severity && u === urgency;
              return (
                <span
                  key={u}
                  className={cn(
                    "relative flex aspect-[1.35] items-center justify-center rounded-[4px] text-[10px] font-bold",
                    here
                      ? "z-10 shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--foreground)]"
                      : "opacity-[0.28]",
                  )}
                  style={{ background: GRADE_FILL[l], color: GRADE_INK[l] }}
                >
                  {here ? l : ""}
                </span>
              );
            })}
          </div>
        ))}
        <span />
        {URGENCY_COLS.map((u) => (
          <span
            key={u}
            className="pt-1 text-center text-[10px] font-medium leading-tight text-muted-foreground"
          >
            {URGENCY_SHORT[u]}
          </span>
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>Severity ↑</span>
        <span>Urgency →</span>
      </figcaption>
    </figure>
  );
}

export function SeverityDots({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={`Severity ${value} of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="size-2.5 rounded-full"
          style={{ background: n <= value ? "var(--foreground)" : "var(--border)" }}
        />
      ))}
    </span>
  );
}

const CONF_BARS: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

/** Signal-strength bars: how sure the model was about this photo. */
export function ConfidenceBars({ level }: { level: Confidence }) {
  const n = CONF_BARS[level];
  return (
    <span className="inline-flex items-end gap-[3px]" role="img" aria-label={`${level} confidence`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-1.5 rounded-sm"
          style={{ height: 6 + i * 4, background: i <= n ? "var(--primary)" : "var(--border)" }}
        />
      ))}
    </span>
  );
}

const COST_CEILING = 40000;

/** Where an estimate falls on a $0 to $40k track (square-root scale so small jobs stay visible). */
export function CostBar({ low, high }: { low: number; high: number }) {
  const pos = (n: number) => Math.min(1, Math.sqrt(n / COST_CEILING)) * 100;
  const left = pos(low);
  const width = Math.max(4, pos(high) - left);
  return (
    <div className="relative h-2 rounded-full bg-border" aria-hidden>
      <div
        className="absolute inset-y-0 rounded-full bg-primary"
        style={{ left: `${left}%`, width: `${width}%` }}
      />
    </div>
  );
}

/** Stacked bar of how many confirmed findings landed on each letter. */
export function GradeMix({ counts }: { counts: Partial<Record<Letter, number>> }) {
  const total = LETTERS.reduce((n, l) => n + (counts[l] ?? 0), 0);
  if (!total) return null;
  return (
    <div>
      <div
        className="flex h-3 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={LETTERS.filter((l) => counts[l])
          .map((l) => `${counts[l]} graded ${l}`)
          .join(", ")}
      >
        {LETTERS.filter((l) => counts[l]).map((l) => (
          <div key={l} style={{ flex: counts[l], background: GRADE_FILL[l] }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {LETTERS.filter((l) => counts[l]).map((l) => (
          <li key={l} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: GRADE_FILL[l] }}
              aria-hidden
            />
            <span className="font-semibold">{l}</span>
            <span className="text-muted-foreground">
              {counts[l]} {counts[l] === 1 ? "finding" : "findings"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A to F key: the letter, its plain word and the score band behind it. */
export function GradeLegend() {
  return (
    <ul className="divide-y overflow-hidden rounded-lg border">
      {LETTERS.map((l) => (
        <li key={l} className="flex items-center gap-3 py-1.5 pl-1.5 pr-3 text-sm">
          <span
            className="flex size-7 items-center justify-center rounded font-extrabold"
            style={{ background: GRADE_FILL[l], color: GRADE_INK[l] }}
          >
            {l}
          </span>
          <span className="font-medium">{LETTER_WORD[l]}</span>
          <span className="ml-auto tabular-nums text-muted-foreground">
            score {LETTER_SCORES[l]}
          </span>
        </li>
      ))}
    </ul>
  );
}
