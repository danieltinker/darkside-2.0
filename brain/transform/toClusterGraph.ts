import type { Node, Edge } from "@xyflow/react";
import type { BrainModel } from "@/brain/types";
import { layoutGraph } from "@/brain/transform/layout";

export function toClusterGraph(model: BrainModel): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  for (const cat of model.categories) {
    const catId = `cat:${cat.id}`;
    nodes.push({
      id: catId,
      type: "category",
      position: { x: 0, y: 0 },
      data: {
        name: cat.name,
        version: cat.version,
        status: cat.status,
        dispatchGate: cat.dispatchGate,
        scoring: cat.scoring,
        rubricCount: cat.rubrics.length,
      },
    });

    for (const rub of cat.rubrics) {
      const rubId = `rub:${rub.id}`;
      const tracedCount = rub.signals.filter((s) => s.attackGraph.source === "traced").length;
      nodes.push({
        id: rubId,
        type: "rubric",
        position: { x: 0, y: 0 },
        data: {
          rubricId: rub.id,
          name: rub.name,
          severity: rub.severity,
          pointsIfStrong: rub.pointsIfStrong,
          requiredBoundaries: rub.requiredBoundaries,
          signalCount: rub.signals.length,
          provenance: rub.provenance,
          hasTraced: tracedCount > 0,
        },
      });
      edges.push({ id: `${catId}->${rubId}`, source: catId, target: rubId, label: "contains" });

      for (const sig of rub.signals) {
        const sigId = `sig:${sig.id}`;
        nodes.push({
          id: sigId,
          type: "signal",
          position: { x: 0, y: 0 },
          data: {
            signalId: sig.id,
            name: sig.name,
            strength: sig.strength,
            points: sig.points,
            requiredNodeCount: sig.requiredNodes.length,
            graphSource: sig.attackGraph.source,
          },
        });
        edges.push({ id: `${rubId}->${sigId}`, source: rubId, target: sigId });
      }
    }
  }

  return { nodes: layoutGraph(nodes, edges, "LR"), edges };
}
