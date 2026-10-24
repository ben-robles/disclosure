import { describe, expect, it } from "vitest";
import { gradeRange, letterFor, needsPro, overallGrade, risk } from "./grading";
import { lookupCost } from "./costs";
import { parseModelOutput } from "./parse";
import { MD_SECTIONS, sectionNumber } from "./jurisdiction";
import { totalCost } from "./report";
import { TAXONOMY } from "./taxonomy";

describe("risk → letter boundaries", () => {
  it.each([
    [1, "A"], [3, "A"], [4, "B"], [6, "B"], [7, "C"], [10, "C"], [11, "D"], [15, "D"], [16, "F"], [20, "F"],
  ])("risk %i → %s", (r, l) => expect(letterFor(r)).toBe(l));
  it("risk = severity × urgency score", () => expect(risk(4, "immediate")).toBe(16));
});

describe("confidence ranges", () => {
  it("high → single letter", () => expect(gradeRange(3, "30_days", "high")).toEqual(["C"]));
  it("medium → letter and next worse", () => expect(gradeRange(3, "30_days", "medium")).toEqual(["C", "D"]));
  it("medium at F stays F", () => expect(gradeRange(5, "immediate", "medium")).toEqual(["F"]));
  it("low → no grade", () => expect(gradeRange(5, "immediate", "low")).toBeNull());
});

describe("overall grade", () => {
  it("is the worst worst-end letter, not an average", () => {
    expect(overallGrade([["A"], ["A"], ["C", "D"]])).toBe("D");
  });
  it("ignores ungraded findings", () => expect(overallGrade([null, ["B"]])).toBe("B"));
  it("D or F recommends a pro", () => {
    expect(needsPro(["C", "D"])).toBe(true);
    expect(needsPro(["C"])).toBe(false);
  });
});

describe("cost lookup", () => {
  it("uses severity buckets", () => {
    expect(lookupCost("roof", 2)).toEqual({ low: 300, high: 1500 });
    expect(lookupCost("roof", 3)).toEqual({ low: 1000, high: 5000 });
    expect(lookupCost("roof", 5)).toEqual({ low: 5000, high: 20000 });
  });
  it("unclear has no cost", () => expect(lookupCost("unclear", 3)).toBeNull());
});

describe("model output parsing", () => {
  const base = { defect_type: "roof", severity: 3, urgency: "30_days", confidence: "high", image_quality: "ok", reason: "x" };
  it("strips code fences", () => expect(parseModelOutput("```json\n" + JSON.stringify(base) + "\n```")?.defect_type).toBe("roof"));
  it("unknown type → unclear", () => expect(parseModelOutput(JSON.stringify({ ...base, defect_type: "pool" }))?.defect_type).toBe("unclear"));
  it("invalid JSON → null", () => expect(parseModelOutput("I see a crack")).toBeNull());
  it("low confidence → unclear", () => expect(parseModelOutput(JSON.stringify({ ...base, confidence: "low" }))?.defect_type).toBe("unclear"));
});

describe("Maryland sections", () => {
  it("every defect type maps to a real, numbered form section", () => {
    for (const t of TAXONOMY) {
      expect(MD_SECTIONS[t.id]).not.toMatch(/PLACEHOLDER/);
      expect(sectionNumber(MD_SECTIONS[t.id])).toBeGreaterThan(0);
    }
  });
  it("orders by form item number, not alphabetically", () => {
    const names = ["17. Wood-destroying Insects", "5. Roof", "10. Electric Systems"];
    expect(names.sort((a, b) => sectionNumber(a) - sectionNumber(b))).toEqual(["5. Roof", "10. Electric Systems", "17. Wood-destroying Insects"]);
  });
});

describe("totalCost", () => {
  it("sums low and high ends", () =>
    expect(totalCost([{ cost: { low: 100, high: 500 } }, { cost: { low: 200, high: 1000 } }])).toEqual({ low: 300, high: 1500 }));
  it("skips findings without an estimate", () =>
    expect(totalCost([{ cost: null }, { cost: { low: 100, high: 500 } }])).toEqual({ low: 100, high: 500 }));
  it("is null when nothing has an estimate", () => expect(totalCost([{ cost: null }])).toBeNull());
});
