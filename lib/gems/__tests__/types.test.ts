import { describe, it, expect } from "vitest";
import { ChainSchema } from "@/lib/gems/types";

describe("ChainSchema", () => {
  it("accepts a valid strong chain", () => {
    const r = ChainSchema.safeParse({
      chain_id: "x", name: "X", strength: "strong", points: 8,
      score_mode: "all_or_nothing", required_boundaries: ["render"], required_nodes: ["n3_load"],
    });
    expect(r.success).toBe(true);
  });
  it("rejects points outside 8/4/2", () => {
    const r = ChainSchema.safeParse({
      chain_id: "x", name: "X", strength: "strong", points: 5,
      score_mode: "all_or_nothing", required_boundaries: [], required_nodes: [],
    });
    expect(r.success).toBe(false);
  });
});
