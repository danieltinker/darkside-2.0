import type { Node, Edge } from "@xyflow/react";
import type { AttackGraphView } from "@/brain/types";
import { layoutGraph } from "@/brain/transform/layout";

export function toAttackGraph(graph: AttackGraphView): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map((n) => ({
    id: n.id,
    type: "attack",
    position: { x: 0, y: 0 },
    data: {
      label: n.label,
      kind: n.kind,
      phase: n.phase,
      boundary: n.boundary ?? null,
      behavioralRole: n.behavioralRole,
      isRequired: n.isRequired,
      staticConfirmed: n.staticConfirmed,
      fridaHook: n.fridaHook,
      signature: n.signature,
      isEntry: n.id === graph.entry,
      mock: graph.source === "mock",
    },
  }));

  const edges: Edge[] = graph.edges.map((e, i) => ({
    id: `e${i}:${e.from}->${e.to}`,
    source: e.from,
    target: e.to,
    label: e.label ?? e.relation,
    data: { relation: e.relation },
  }));

  return { nodes: layoutGraph(nodes, edges, "TB"), edges };
}
