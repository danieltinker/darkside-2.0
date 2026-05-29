import type { ReactNode } from "react";
import type { Reconciliation, ReconciledNode } from "@/lib/reconcile";
import type { ArtifactContent } from "@/lib/mock";
import type { FlowEdge, EdgeRelation } from "@/lib/contract";
import { NodeCard } from "./NodeCard";

const STAGE_LABEL: Record<1 | 2 | 3, string> = {
  1: "Stage 1",
  2: "Stage 2",
  3: "Stage 3",
};

const RELATION_TONE: Record<EdgeRelation, string> = {
  calls: "text-accent-cyan border-accent-cyan/30",
  returns: "text-accent-violet border-accent-violet/30",
  data_to: "text-accent-amber border-accent-amber/30",
  triggers: "text-accent-green border-accent-green/30",
};

function relationBetween(
  edges: FlowEdge[],
  fromId: string,
  toId: string,
): EdgeRelation | undefined {
  const direct = edges.find((e) => e.from === fromId && e.to === toId);
  if (direct) return direct.relation;
  // not display-adjacent in the graph: label by how `to` is reached
  return edges.find((e) => e.to === toId)?.relation;
}

function Connector({ relation }: { relation?: EdgeRelation }) {
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <svg width="2" height="14" className="overflow-visible">
        <line
          x1="1"
          y1="0"
          x2="1"
          y2="14"
          className={`edge-flow stroke-edge-strong`}
          strokeWidth="2"
        />
      </svg>
      {relation && (
        <span
          className={`rounded-full border bg-bg-base px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${RELATION_TONE[relation]}`}
        >
          {relation}
        </span>
      )}
      <svg width="10" height="14" className="overflow-visible">
        <line x1="5" y1="0" x2="5" y2="10" className="stroke-edge-strong" strokeWidth="2" />
        <path d="M1 8 L5 13 L9 8" className="fill-none stroke-edge-strong" strokeWidth="2" />
      </svg>
    </div>
  );
}

function BandHeader({ stage, title, count }: { stage: 1 | 2 | 3; title: string; count: number }) {
  return (
    <div className="mb-2 mt-1 flex items-center gap-3">
      <span className="flex h-6 items-center rounded-md border border-edge-strong bg-bg-raised px-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
        {STAGE_LABEL[stage]}
      </span>
      <span className="text-[13px] font-medium text-ink-primary">{title}</span>
      <span className="font-mono text-[11px] text-ink-faint">
        {count} node{count > 1 ? "s" : ""}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-edge to-transparent" />
    </div>
  );
}

export function CallGraph({
  recon,
  edges,
  artifactContent,
  showDynamic = true,
  renderHumanControls,
}: {
  recon: Reconciliation;
  edges: FlowEdge[];
  artifactContent: Record<string, ArtifactContent>;
  showDynamic?: boolean;
  renderHumanControls?: (rn: ReconciledNode) => ReactNode;
}) {
  const ordered = recon.nodes;
  return (
    <div className="space-y-0">
      {ordered.map((rn, i) => {
        const prev = ordered[i - 1];
        const isStageStart = !prev || prev.node.stage !== rn.node.stage;
        const band = recon.bands.find((b) => b.stage === rn.node.stage)!;
        const next = ordered[i + 1];
        const relation = next
          ? relationBetween(edges, rn.node.node_id, next.node.node_id)
          : undefined;
        return (
          <div key={rn.node.node_id}>
            {isStageStart && (
              <BandHeader stage={band.stage} title={band.title} count={band.nodes.length} />
            )}
            <NodeCard
              rn={rn}
              artifactContent={artifactContent}
              urlIntel={rn.node.produces_url ? recon.urlIntel : undefined}
              showDynamic={showDynamic}
              humanControls={renderHumanControls?.(rn)}
            />
            {next && <Connector relation={relation} />}
          </div>
        );
      })}
    </div>
  );
}
