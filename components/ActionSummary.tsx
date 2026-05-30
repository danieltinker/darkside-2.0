import type { Reconciliation, ReconciledNode } from "@/lib/reconcile";
import { StatusChip } from "./StatusChip";

const PHASE_LABEL: Record<string, string> = {
  lifecycle: "Lifecycle & SDK setup",
  acquisition: "Acquire signal",
  cloaking_gate: "Cloaking gate",
  url_resolution: "Resolve destination",
  render: "Render in WebView",
};

function rollupStatus(nodes: ReconciledNode[]): "confirmed" | "failed" | "pending" {
  if (nodes.some((n) => n.status === "failed")) return "failed";
  if (nodes.every((n) => n.status === "confirmed")) return "confirmed";
  return "pending";
}

export function ActionSummary({
  recon, onJump,
}: { recon: Reconciliation; onJump: (nodeId: string) => void }) {
  const phases = [...new Set(recon.nodes.map((n) => n.node.phase ?? "other"))];
  const boundaryPhases = phases.filter((p) =>
    recon.nodes.some((n) => (n.node.phase ?? "other") === p && n.isRequired),
  ).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-ink-muted">
        <span className="uppercase tracking-wider text-ink-faint">Pipeline</span>
        <span>{phases.length} phases · runs left → right (1 → {phases.length})</span>
        <span className="text-ink-faint">·</span>
        <span>
          <span className="text-accent-cyan">{boundaryPhases}</span> carry a scored boundary node
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {phases.map((phase, i) => {
          const nodes = recon.nodes.filter((n) => (n.node.phase ?? "other") === phase);
          const status = rollupStatus(nodes);
          const isBoundary = nodes.some((n) => n.isRequired);
          const tone = status === "confirmed" ? "green" : status === "failed" ? "red" : "amber";
          return (
            <button
              key={phase}
              onClick={() => onJump(nodes[0].node.node_id)}
              className={`flex flex-col rounded-xl border p-3 text-left transition-colors hover:border-edge-strong ${
                isBoundary ? "border-accent-cyan/40 bg-accent-cyan/[0.04]" : "border-edge bg-bg-card/70"
              }`}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-edge-strong bg-bg-raised font-mono text-[11px] font-semibold text-ink-secondary"
                  title={`step ${i + 1} of ${phases.length}`}
                >
                  {i + 1}
                </span>
                <StatusChip tone={tone} dot label={status} />
                {isBoundary && <StatusChip tone="cyan" label="boundary" title="Carries a node that gates the score" />}
              </div>
              <span className="text-[13px] font-semibold text-ink-primary">
                {PHASE_LABEL[phase] ?? phase}
              </span>
              <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
                {nodes.length} call{nodes.length > 1 ? "s" : ""}
                {nodes.length > 1 ? ` · ${nodes.map((n) => n.node.label.split("(")[0]).slice(0, 3).join(" → ")}…` : ""}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
