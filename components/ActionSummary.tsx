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
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {phases.map((phase) => {
        const nodes = recon.nodes.filter((n) => (n.node.phase ?? "other") === phase);
        const status = rollupStatus(nodes);
        const isBoundary = nodes.some((n) => n.isRequired);
        const tone = status === "confirmed" ? "green" : status === "failed" ? "red" : "amber";
        return (
          <button
            key={phase}
            onClick={() => onJump(nodes[0].node.node_id)}
            className={`rounded-xl border p-3 text-left transition-colors hover:border-edge-strong ${
              isBoundary ? "border-accent-cyan/40 bg-accent-cyan/[0.04]" : "border-edge bg-bg-card/70"
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink-primary">
                {PHASE_LABEL[phase] ?? phase}
              </span>
              <StatusChip tone={tone} dot label={status} />
            </div>
            <p className="font-mono text-[11px] text-ink-muted">
              {nodes.length} call{nodes.length > 1 ? "s" : ""}
              {nodes.length > 1 ? ` · ${nodes.map((n) => n.node.label.split("(")[0]).slice(0, 3).join(" → ")}…` : ""}
            </p>
          </button>
        );
      })}
    </div>
  );
}
