import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// `capture` makes phones open the camera straight away, with no way to pick an existing photo.
describe("Photo file inputs", () => {
  for (const file of ["capture.tsx", "findings.tsx"]) {
    it(`${file} lets the phone offer both camera and library`, () => {
      const source = readFileSync(path.resolve(__dirname, "../routes", file), "utf8");

      expect(source).toContain('type="file"');
      expect(source).not.toMatch(/\bcapture=/);
    });
  }
});
