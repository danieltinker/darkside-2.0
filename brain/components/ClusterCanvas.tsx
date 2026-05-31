"use client";

import { useMemo } from "react";
import { ReactFlow, Background, Controls, MiniMap, BackgroundVariant } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { BrainModel } from "@/brain/types";
import { toClusterGraph } from "@/brain/transform/toClusterGraph";
import { CategoryNode } from "@/brain/components/nodes/CategoryNode";
import { RubricNode } from "@/brain/components/nodes/RubricNode";
import { SignalNode } from "@/brain/components/nodes/SignalNode";

const nodeTypes = { category: CategoryNode, rubric: RubricNode, signal: SignalNode };

export function ClusterCanvas({ model, onOpenSignal }: { model: BrainModel; onOpenSignal: (signalId: string) => void }) {
  const { nodes, edges } = useMemo(() => toClusterGraph(model), [model]);
  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.15}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          if (node.type === "signal") onOpenSignal((node.data as any).signalId);
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
