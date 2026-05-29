import { describe, it, expect } from "vitest";
import { loadGraphGem, loadChains, loadCategory } from "@/lib/gems/loadGem";

const RUBRIC = "attribution_gated_webview_uncloaking";

describe("loadGem", () => {
  it("loads + validates the graph gem with 9 nodes", () => {
    const g = loadGraphGem(RUBRIC);
    expect(g.nodes).toHaveLength(9);
    expect(g.required_nodes).toEqual(["n1_callback", "n2_parse", "n3_load"]);
  });
  it("loads the strong_8 chain", () => {
    const c = loadChains(RUBRIC);
    expect(c.chains[0].points).toBe(8);
  });
  it("loads the category with metadata gate 8", () => {
    expect(loadCategory("riskware").dispatch_gate.metadata_score_gte).toBe(8);
  });
});
