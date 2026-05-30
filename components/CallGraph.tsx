"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { Reconciliation, ReconciledNode } from "@/lib/reconcile";
import type { ArtifactContent } from "@/lib/mock";
import type { FlowEdge, EdgeRelation } from "@/lib/contract";
import { NodeCard } from "./NodeCard";
import { ActionSummary } from "./ActionSummary";

const RELATION_TONE: Record<EdgeRelation, string> = {
  calls: "text-accent-cyan border-accent-cyan/30",
  returns: "text-accent-violet border-accent-violet/30",
  data_to: "text-accent-amber border-accent-amber/30",
  triggers: "text-accent-green border-accent-green/30",
  initializes: "text-accent-cyan border-accent-cyan/30",
  registers: "text-accent-cyan border-accent-cyan/30",
  async_triggers: "text-accent-green border-accent-green/30",
  branch_benign: "text-emerald-400 border-emerald-400/40",
  branch_uncloaked: "text-rose-400 border-rose-400/40",
  resolves_or_requests: "text-accent-amber border-accent-amber/30",
  destination_to_container: "text-accent-violet border-accent-violet/30",
  loads: "text-accent-violet border-accent-violet/30",
};

function edgeBetween(
  edges: FlowEdge[],
  fromId: string,
  toId: string,
): FlowEdge | undefined {
  const direct = edges.find((e) => e.from === fromId && e.to === toId);
  if (direct) return direct;
  // not display-adjacent in the graph: label by how `to` is reached
  return edges.find((e) => e.to === toId);
}

function Connector({ edge }: { edge?: FlowEdge }) {
  // The branch label (e.g. "af_status == Non-organic") is the cloak proof —
  // surface it verbatim; otherwise fall back to the relation name.
  const caption = edge?.label ?? edge?.relation;
  const tone = edge ? RELATION_TONE[edge.relation] : "";
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
      {caption && (
        <span
          className={`rounded-full border bg-bg-base px-2 py-0.5 font-mono text-[10px] tracking-wider ${edge?.label ? "" : "uppercase"} ${tone}`}
        >
          {caption}
        </span>
      )}
      <svg width="10" height="14" className="overflow-visible">
        <line x1="5" y1="0" x2="5" y2="10" className="stroke-edge-strong" strokeWidth="2" />
        <path d="M1 8 L5 13 L9 8" className="fill-none stroke-edge-strong" strokeWidth="2" />
      </svg>
    </div>
  );
}

function BandHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-2 mt-1 flex items-center gap-3">
      <span className="flex h-6 items-center rounded-md border border-edge-strong bg-bg-raised px-2 text-[13px] font-medium text-ink-primary">
        {title}
      </span>
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
  const [view, setView] = useState<"summary" | "trace">("summary");
  const ordered = recon.nodes;

  return (
    <div className="space-y-0">
      {/* Altitude toggle */}
      <div className="mb-3 flex items-center gap-1 rounded-lg border border-edge bg-bg-raised p-1 w-fit">
        <button
          onClick={() => setView("summary")}
          className={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
            view === "summary"
              ? "bg-bg-card text-ink-primary shadow-sm"
              : "text-ink-muted hover:text-ink-secondary"
          }`}
        >
          Actions
        </button>
        <button
          onClick={() => setView("trace")}
          className={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
            view === "trace"
              ? "bg-bg-card text-ink-primary shadow-sm"
              : "text-ink-muted hover:text-ink-secondary"
          }`}
        >
          Trace
        </button>
      </div>

      {view === "summary" ? (
        <ActionSummary
          recon={recon}
          onJump={(id) => {
            setView("trace");
            requestAnimationFrame(() =>
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }),
            );
          }}
        />
      ) : (
        ordered.map((rn, i) => {
          const prev = ordered[i - 1];
          const phase = rn.node.phase ?? "other";
          const isPhaseStart = !prev || (prev.node.phase ?? "other") !== phase;
          const band = recon.bands.find((b) => b.phase === phase)!;
          const next = ordered[i + 1];
          const edge = next
            ? edgeBetween(edges, rn.node.node_id, next.node.node_id)
            : undefined;
          return (
            <div key={rn.node.node_id}>
              {isPhaseStart && <BandHeader title={band.title} count={band.nodes.length} />}
              <NodeCard
                rn={rn}
                artifactContent={artifactContent}
                urlIntel={rn.node.produces_url ? recon.urlIntel : undefined}
                showDynamic={showDynamic}
                humanControls={renderHumanControls?.(rn)}
              />
              {next && <Connector edge={edge} />}
            </div>
          );
        })
      )}
    </div>
  );
}
