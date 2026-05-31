import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { loadCategory, loadChains, loadGraphGem } from "@/lib/gems/loadGem";
import { compileFlowGraph } from "@/lib/gems/compileMission";

// =====================================================================
// FAIL-SAFE GUARDS — turn the manual structure audit into permanent invariants
// so the Category→Rubric→Signal→Graph connection logic can never silently drift.
// =====================================================================

const RUBRICS_DIR = path.join(process.cwd(), "gems", "riskware", "rubrics");
const dirs = readdirSync(RUBRICS_DIR).filter((d) => existsSync(path.join(RUBRICS_DIR, d, "chains.yaml")));
const TRACED = "attribution_gated_webview_uncloaking";
const cat = loadCategory("riskware");

describe("gem integrity · routing + identity", () => {
  it("category rubric_ids EXACTLY match the on-disk rubric directories (no orphans, no missing)", () => {
    expect(cat.rubrics.map((r) => r.rubric_id).sort()).toEqual([...dirs].sort());
  });

  it.each(dirs)("rubric '%s': rubric.yaml + chains.yaml ids match the directory + category", (dir) => {
    const rubric = parse(readFileSync(path.join(RUBRICS_DIR, dir, "rubric.yaml"), "utf8")) as {
      rubric_id: string;
      category: string;
    };
    expect(rubric.rubric_id).toBe(dir);
    expect(rubric.category).toBe("riskware");
    expect(loadChains(dir).rubric_id).toBe(dir);
  });

  it.each(dirs)("rubric '%s': every chain's strength→points matches the category scoring model", (dir) => {
    const sm = cat.scoring_model as unknown as Record<string, number>;
    for (const c of loadChains(dir).chains) {
      expect(c.points, `${dir} · ${c.chain_id}`).toBe(sm[c.strength]);
      expect(c.score_mode).toBe("all_or_nothing");
    }
  });
});

describe("gem integrity · traced graph well-formedness", () => {
  it("entry, every edge endpoint, and every required_node reference REAL node ids", () => {
    const g = compileFlowGraph(loadGraphGem(TRACED));
    const ids = new Set(g.nodes.map((n) => n.node_id));
    expect(ids.has(g.entry)).toBe(true);
    for (const e of g.edges) {
      expect(ids.has(e.from), `edge from ${e.from}`).toBe(true);
      expect(ids.has(e.to), `edge to ${e.to}`).toBe(true);
    }
    for (const rn of g.required_nodes) expect(ids.has(rn), `required ${rn}`).toBe(true);
  });

  it("every node carries a signature + a static_confirmed flag", () => {
    for (const n of loadGraphGem(TRACED).nodes) {
      expect(n.signature, n.node_id).toBeTruthy();
      expect(typeof n.static_confirmed).toBe("boolean");
    }
  });
});

describe("gem integrity · scoring ↔ flow lock (the decoupling guard)", () => {
  // The audit's strongest invariant: the chain says "confirm these boundary nodes
  // for the points" and the graph is those nodes wired together. If someone edits
  // one without the other, the score silently decouples from the visualized flow.
  it("graph.required_nodes === the traced chain's required_nodes", () => {
    const g = compileFlowGraph(loadGraphGem(TRACED));
    const chain = loadChains(TRACED).chains.find((c) => c.required_nodes)!;
    expect([...chain.required_nodes!].sort()).toEqual([...g.required_nodes].sort());
  });

  it("each required node's boundary is declared in the chain's required_boundaries", () => {
    const g = loadGraphGem(TRACED);
    const chain = loadChains(TRACED).chains.find((c) => c.required_boundaries)!;
    const required = new Set(chain.required_nodes ?? []);
    for (const n of g.nodes.filter((x) => required.has(x.node_id))) {
      expect(chain.required_boundaries, `${n.node_id} boundary ${n.boundary}`).toContain(n.boundary);
    }
  });
});
