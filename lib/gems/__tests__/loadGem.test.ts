import { describe, it, expect } from "vitest";
import { loadGraphGem, loadChains, loadCategory, loadBlueprint } from "@/lib/gems/loadGem";

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

// Behavioral blueprints converted from the private chains .dot files.
describe("behavioral blueprints", () => {
  const ALL = [
    "onConversionDataSucces", "httpResponseWebView", "conditionalStaticSignals",
    "dynamicDexDecryption", "privacyPolicyRedirection",
  ];

  it("every blueprint loads, validates, and has a conditional gate", () => {
    for (const id of ALL) {
      const g = loadBlueprint(id);
      expect(g.nodes.length).toBeGreaterThanOrEqual(10);
      expect(g.nodes.some((n) => n.kind === "condition")).toBe(true); // the cloak gate
    }
  });

  it("MMP blueprint is the faithful 14-node graph with the cloak branches", () => {
    const g = loadBlueprint("onConversionDataSucces");
    expect(g.entry).toBe("N1");
    expect(g.nodes).toHaveLength(14); // N1..N13 with N7 split into 7a/7b
    expect(g.nodes.find((n) => n.node_id === "N6")!.kind).toBe("condition");
    expect(g.nodes.find((n) => n.node_id === "N7a")!.kind).toBe("benign_branch");
    expect(g.nodes.find((n) => n.node_id === "N10")!.kind).toBe("sink");
    expect(g.nodes.find((n) => n.node_id === "N13")!.kind).toBe("verdict");
    // the two acquisition→gate branch edges are preserved with their conditions
    const branches = g.edges.filter((e) => e.from === "N6").map((e) => e.label);
    expect(branches).toContain("af_status == Organic");
    expect(branches).toContain("af_status == Non-organic");
    // six distinct phase bands from the source clusters
    expect(new Set(g.nodes.map((n) => n.phase)).size).toBe(6);
  });
});

// The blueprint→chain relation must resolve to a real chain in the named rubric.
describe("blueprint ↔ chain relations", () => {
  it("each owned blueprint points at a real chain in its rubric", () => {
    for (const id of ["onConversionDataSucces", "httpResponseWebView",
      "conditionalStaticSignals", "privacyPolicyRedirection"]) {
      const bp = loadBlueprint(id);
      expect(bp.rubric_id).toBeTruthy();
      expect(bp.chain_id).toBeTruthy();
      const chainIds = loadChains(bp.rubric_id!).chains.map((c) => c.chain_id);
      expect(chainIds).toContain(bp.chain_id);
    }
  });
});
