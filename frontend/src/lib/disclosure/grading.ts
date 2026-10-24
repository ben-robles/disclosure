export type Urgency = "immediate" | "30_days" | "1_year" | "cosmetic";
export type Confidence = "high" | "medium" | "low";
export type Letter = "A" | "B" | "C" | "D" | "F";

export const LETTERS: Letter[] = ["A", "B", "C", "D", "F"];
export const URGENCY_SCORE: Record<Urgency, number> = {
  immediate: 4,
  "30_days": 3,
  "1_year": 2,
  cosmetic: 1,
};
export const URGENCY_LABEL: Record<Urgency, string> = {
  immediate: "Fix immediately",
  "30_days": "Within 30 days",
  "1_year": "Within a year",
  cosmetic: "Cosmetic",
};
export const LETTER_WORD: Record<Letter, string> = {
  A: "Minor",
  B: "Moderate",
  C: "Serious",
  D: "Urgent",
  F: "Critical",
};

export const LETTER_SCORES: Record<Letter, string> = {
  A: "1 to 3",
  B: "4 to 6",
  C: "7 to 10",
  D: "11 to 15",
  F: "16 to 20",
};

export const GRADING_RULE =
  "Overall grade = the worst confirmed finding's worst-end letter.";

export function risk(severity: number, urgency: Urgency): number {
  return severity * URGENCY_SCORE[urgency];
}

export function letterFor(r: number): Letter {
  if (r <= 3) return "A";
  if (r <= 6) return "B";
  if (r <= 10) return "C";
  if (r <= 15) return "D";
  return "F";
}

/** null = no grade (low confidence). */
export function gradeRange(
  severity: number,
  urgency: Urgency,
  confidence: Confidence,
): Letter[] | null {
  if (confidence === "low") return null;
  const l = letterFor(risk(severity, urgency));
  if (confidence === "high") return [l];
  const i = LETTERS.indexOf(l);
  return i === LETTERS.length - 1 ? [l] : [l, LETTERS[i + 1]!];
}

export function worstEnd(range: Letter[]): Letter {
  return range[range.length - 1]!;
}

export function overallGrade(ranges: (Letter[] | null)[]): Letter | null {
  let worst = -1;
  for (const r of ranges) {
    if (!r) continue;
    worst = Math.max(worst, LETTERS.indexOf(worstEnd(r)));
  }
  return worst < 0 ? null : LETTERS[worst]!;
}

export function needsPro(range: Letter[] | null): boolean {
  return !!range && (worstEnd(range) === "D" || worstEnd(range) === "F");
}

export function formatRange(range: Letter[]): string {
  return range.join("–");
}
