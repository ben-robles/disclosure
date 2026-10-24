import { cn } from "@/lib/utils";
import { LETTER_WORD, worstEnd, type Letter } from "@/lib/disclosure/grading";
import { GRADE_FILL, GRADE_INK } from "./RiskViz";

/** Filled grade stamp. A two-letter range is split into two halves so the width of the doubt is visible. */
export function GradeBadge({ range, large }: { range: Letter[] | null; large?: boolean }) {
  if (!range) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md bg-muted px-2.5 py-1 font-semibold text-muted-foreground",
          large ? "text-base" : "text-sm",
        )}
        aria-label="No grade"
      >
        Can't grade
      </span>
    );
  }
  const w = worstEnd(range);
  const word = LETTER_WORD[w];
  const label =
    range.length > 1 ? `Grade ${range[0]} to ${range[1]}, ${word}` : `Grade ${range[0]}, ${word}`;
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-flex items-stretch overflow-hidden rounded-md shadow-sm"
    >
      {range.map((l) => (
        <span
          key={l}
          className={cn(
            "flex items-center justify-center font-extrabold leading-none",
            large ? "size-12 text-3xl" : "size-8 text-lg",
          )}
          style={{ background: GRADE_FILL[l], color: GRADE_INK[l] }}
        >
          {l}
        </span>
      ))}
      <span
        className={cn(
          "flex items-center bg-foreground font-semibold text-background",
          large ? "px-3 text-base" : "px-2 text-xs",
        )}
      >
        {word}
      </span>
    </span>
  );
}
