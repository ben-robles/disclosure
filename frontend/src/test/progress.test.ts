import { describe, expect, it } from "vitest";
import { DEFAULT_PHOTO_MS, expectedPhotoMs, inFlightFraction } from "@/lib/disclosure/progress";

describe("expectedPhotoMs", () => {
  it("uses the default until a photo has finished", () => {
    expect(expectedPhotoMs([])).toBe(DEFAULT_PHOTO_MS);
  });
  it("is the mean of the last five finished photos", () => {
    expect(expectedPhotoMs([60_000, 10_000, 10_000, 10_000, 10_000, 10_000])).toBe(10_000);
  });
  it("stays within sane bounds", () => {
    expect(expectedPhotoMs([10])).toBe(3_000);
    expect(expectedPhotoMs([900_000])).toBe(120_000);
  });
});

describe("inFlightFraction", () => {
  it("starts at zero and never reaches one", () => {
    expect(inFlightFraction(0, 10_000)).toBe(0);
    expect(inFlightFraction(-5, 10_000)).toBe(0);
    expect(inFlightFraction(10 * 60_000, 10_000)).toBeLessThan(0.951);
  });
  it("is about 82% at the expected time, so the bar keeps pace with a normal photo", () => {
    const at = inFlightFraction(10_000, 10_000);
    expect(at).toBeGreaterThan(0.8);
    expect(at).toBeLessThan(0.84);
  });
  it("only moves forward", () => {
    expect(inFlightFraction(5_000, 10_000)).toBeLessThan(inFlightFraction(6_000, 10_000));
  });
});
