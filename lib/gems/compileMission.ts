import type { FlowGraph, FlowNode } from "@/lib/contract";
import type { GraphGem, GemNode } from "./types";

function toFlowNode(n: GemNode): FlowNode {
  return {
    node_id: n.node_id,
    stage: n.stage,
    label: n.label,
    kind: n.kind,
    signature: n.signature,
    frida_hook: n.frida_hook,
    static_confirmed: n.static_confirmed,
    produces_url: n.produces_url,
    decryptor: n.decryptor,
    native_file: n.native_file,
    behavioral_role: n.behavioral_role,
    phase: n.phase,
    boundary: n.boundary ?? null,
    flexible_match: n.flexible_match,
  };
}

export function compileFlowGraph(gem: GraphGem): FlowGraph {
  return {
    entry: gem.entry,
    nodes: gem.nodes.map(toFlowNode),
    edges: gem.edges.map((e) => ({ from: e.from, to: e.to, relation: e.relation })),
    required_nodes: gem.required_nodes,
  };
}
