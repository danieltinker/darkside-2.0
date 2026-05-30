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

  it("registers the processed rubrics in the category", () => {
    const ids = loadCategory("riskware").rubrics.map((r) => r.rubric_id);
    expect(ids).toContain("arbitrary_obfuscated_url_loading");
    expect(ids).toContain("command_and_control");
  });
});

// Signal-level rubrics processed from the private source-of-truth spreadsheet:
// validate they load and that the strength→points mapping is exact.
describe("processed signal-level rubrics", () => {
  const POINTS: Record<string, number> = { strong: 8, medium: 4, weak: 2, non_signal: 0 };

  it("command_and_control: one strong known-URL chain (8)", () => {
    const c = loadChains("command_and_control");
    expect(c.chains).toHaveLength(1);
    expect(c.chains[0].strength).toBe("strong");
    expect(c.chains[0].points).toBe(8);
  });

  it("arbitrary_obfuscated_url_loading: 10 chains, every strength maps to the right points", () => {
    const c = loadChains("arbitrary_obfuscated_url_loading");
    expect(c.chains).toHaveLength(10);
    for (const chain of c.chains) {
      expect(chain.points).toBe(POINTS[chain.strength]);
    }
    // the Firebase strong signal is present
    expect(c.chains.some((x) => /firebase/i.test(x.name) && x.points === 8)).toBe(true);
  });
});
