import { cn } from "@/lib/utils";
import { formatRange, LETTER_WORD, worstEnd, type Letter } from "@/lib/disclosure/grading";

const tone: Record<Letter, string> = {
  A: "border-grade-good text-grade-good",
  B: "border-grade-good text-grade-good",
  C: "border-grade-mid text-grade-mid",
  D: "border-grade-bad text-grade-bad",
  F: "border-grade-bad text-grade-bad",
};

export function GradeBadge({ range, large }: { range: Letter[] | null; large?: boolean }) {
  if (!range) {
    return (
      <span className="inline-flex items-center rounded-lg border-2 border-muted-foreground px-2 py-1 text-sm font-semibold text-muted-foreground" aria-label="No grade">
        No grade
      </span>
    );
  }
  const w = worstEnd(range);
  const word = LETTER_WORD[w];
  const label = range.length > 1 ? `Grade ${range[0]} to ${range[1]}, ${word}` : `Grade ${range[0]}, ${word}`;
  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-flex items-baseline gap-2 rounded-lg border-2 bg-background px-2 py-1 font-bold", tone[w], large && "px-4 py-2")}
    >
      <span className={large ? "text-5xl" : "text-2xl"}>{formatRange(range)}</span>
      <span className={large ? "text-lg" : "text-sm"}>{word}</span>
    </span>
  );
}
