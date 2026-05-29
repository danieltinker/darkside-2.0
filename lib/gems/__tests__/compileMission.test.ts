import { describe, it, expect } from "vitest";
import { compileFlowGraph } from "@/lib/gems/compileMission";
import { loadGraphGem } from "@/lib/gems/loadGem";
import { mmpCloakingGraph } from "@/lib/flow";

describe("compileFlowGraph", () => {
  it("reproduces the golden 9-node flow graph (ids, edges, required_nodes)", () => {
    const g = compileFlowGraph(loadGraphGem("attribution_gated_webview_uncloaking"));
    expect(g.nodes.map((n) => n.node_id)).toEqual(mmpCloakingGraph.nodes.map((n) => n.node_id));
    expect(g.edges).toEqual(mmpCloakingGraph.edges);
    expect(g.required_nodes).toEqual(mmpCloakingGraph.required_nodes);
    const deobf = g.nodes.find((n) => n.node_id === "n2_deobf")!;
    expect(deobf.decryptor?.algorithm).toBe("xor");
    expect(deobf.produces_url).toBe(true);
  });
});
