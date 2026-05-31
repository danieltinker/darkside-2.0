import * as dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

const NODE_W = 240;
const NODE_H = 120;

export type Direction = "TB" | "LR";

// Position React Flow nodes with dagre. Returns new node objects (pure-ish:
// same input always yields the same output).
export function layoutGraph<T extends Node>(nodes: T[], edges: Edge[], direction: Direction = "TB"): T[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 80, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    const w = (n.width as number | undefined) ?? NODE_W;
    const h = (n.height as number | undefined) ?? NODE_H;
    g.setNode(n.id, { width: w, height: h });
  }
  for (const e of edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    return {
      ...n,
      position: { x: p.x - p.width / 2, y: p.y - p.height / 2 },
    };
  });
}
