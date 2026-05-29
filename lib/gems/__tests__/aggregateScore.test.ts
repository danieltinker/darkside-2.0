import { describe, it, expect } from "vitest";
import { aggregateScore } from "@/lib/gems/aggregateScore";

describe("aggregateScore", () => {
  it("awards a chain's full points only when fully confirmed; partial = 0", () => {
    const r = aggregateScore([
      { chain_id: "a", points: 8, confirmed: true },
      { chain_id: "b", points: 4, confirmed: false }, // partial/unconfirmed
    ]);
    expect(r.total).toBe(8);
    expect(r.max).toBe(12);
  });
  it("sums multiple confirmed chains", () => {
    const r = aggregateScore([
      { chain_id: "a", points: 8, confirmed: true },
      { chain_id: "b", points: 4, confirmed: true },
    ]);
    expect(r.total).toBe(12);
  });
});
