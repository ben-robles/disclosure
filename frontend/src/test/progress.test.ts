import { describe, expect, it } from "vitest";
import { PHOTO_MS, inFlightFraction } from "@/lib/disclosure/progress";

describe("inFlightFraction", () => {
  it("fills in 8 seconds", () => {
    expect(PHOTO_MS).toBe(8_000);
    expect(inFlightFraction(4_000)).toBeCloseTo(0.5);
  });
  it("starts at zero", () => {
    expect(inFlightFraction(0)).toBe(0);
    expect(inFlightFraction(-5)).toBe(0);
  });
  it("holds at 99% when the photo takes longer than 8 seconds", () => {
    expect(inFlightFraction(8_000)).toBe(0.99);
    expect(inFlightFraction(60_000)).toBe(0.99);
  });
  it("only moves forward", () => {
    expect(inFlightFraction(3_000)).toBeLessThan(inFlightFraction(3_100));
  });
});
