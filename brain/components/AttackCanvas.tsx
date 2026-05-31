"use client";

import { useMemo } from "react";
import { ReactFlow, Background, Controls, MiniMap, BackgroundVariant, Panel } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SignalView, RubricView } from "@/brain/types";
import { toAttackGraph } from "@/brain/transform/toAttackGraph";
import { AttackNode } from "@/brain/components/nodes/AttackNode";

const nodeTypes = { attack: AttackNode };

export function AttackCanvas({ rubric, signal, onBack }: { rubric: RubricView; signal: SignalView; onBack: () => void }) {
  const { nodes, edges } = useMemo(() => toAttackGraph(signal.attackGraph), [signal]);
  const mock = signal.attackGraph.source === "mock";
  const confirmedReq = signal.attackGraph.nodes.filter((n) => n.isRequired).length;

  return (
    <div className="h-full w-full">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.2} proOptions={{ hideAttribution: true }}>
        <Background variant={BackgroundVariant.Dots} gap={24} />
        <MiniMap pannable zoomable />
        <Controls />
        <Panel position="top-left" className="rounded-lg border border-zinc-700/60 bg-bg-card/95 p-3 text-xs">
          <button onClick={onBack} className="mb-2 rounded bg-zinc-700/50 px-2 py-1 text-[11px] hover:bg-zinc-600/50">← back to clusters</button>
          <div className="font-semibold text-zinc-100">{rubric.name}</div>
          <div className="text-zinc-400">{signal.name}</div>
          <div className="mt-1 font-mono text-[10px] text-zinc-300">
            strength {signal.strength} · {signal.points} pts · required {confirmedReq}/{signal.attackGraph.requiredNodes.length}
          </div>
          {mock && (
            <div className="mt-2 rounded bg-amber-500/15 px-2 py-1 text-[10px] text-amber-300">
              MOCK — placeholder graph, to be replaced
            </div>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
}
