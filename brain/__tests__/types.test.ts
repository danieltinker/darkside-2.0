import { describe, it, expect } from "vitest";
import { pointsForStrength, type Strength } from "@/brain/types";

describe("pointsForStrength", () => {
  it("maps strengths to the category scoring tiers", () => {
    expect(pointsForStrength("strong")).toBe(8);
    expect(pointsForStrength("medium")).toBe(4);
    expect(pointsForStrength("weak")).toBe(2);
    expect(pointsForStrength("non_signal")).toBe(0);
  });

  it("covers every Strength member", () => {
    const all: Strength[] = ["strong", "medium", "weak", "non_signal"];
    for (const s of all) expect(typeof pointsForStrength(s)).toBe("number");
  });
});
