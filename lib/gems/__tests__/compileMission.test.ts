import { describe, it, expect } from "vitest";
import { compileFlowGraph } from "@/lib/gems/compileMission";
import { loadGraphGem } from "@/lib/gems/loadGem";
import { mmpCloakingGraph } from "@/lib/flow";

describe("compileFlowGraph", () => {
  it("graph.yaml stays in sync with the traced flow.ts graph (ids, edges, required_nodes)", () => {
    const g = compileFlowGraph(loadGraphGem("attribution_gated_webview_uncloaking"));
    expect(g.nodes.map((n) => n.node_id)).toEqual(mmpCloakingGraph.nodes.map((n) => n.node_id));
    expect(g.edges).toEqual(mmpCloakingGraph.edges);
    expect(g.required_nodes).toEqual(mmpCloakingGraph.required_nodes);
  });

  it("models the explicit cloak gate with both branches", () => {
    const g = compileFlowGraph(loadGraphGem("attribution_gated_webview_uncloaking"));
    expect(g.required_nodes).toEqual(["n4_callback", "n6_gate", "n8_resolve", "n10_load"]);
    expect(g.nodes.find((n) => n.node_id === "n6_gate")!.kind).toBe("condition");
    expect(g.nodes.find((n) => n.node_id === "n7a_benign")!.kind).toBe("benign_branch");
    const branches = g.edges.filter((e) => e.from === "n6_gate").map((e) => e.label);
    expect(branches).toContain("af_status == Organic");
    expect(branches).toContain("af_status == Non-organic");
    const synth = g.nodes.find((n) => n.node_id === "n7b_synth")!;
    expect(synth.decryptor?.algorithm).toBe("xor");
    expect(synth.produces_url).toBe(true);
  });
});
