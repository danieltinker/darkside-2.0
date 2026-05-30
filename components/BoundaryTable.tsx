import type { Reconciliation } from "@/lib/reconcile";
import { StatusChip } from "./StatusChip";

const BOUNDARY_LABEL: Record<string, string> = {
  acquisition_signal: "Acquisition signal",
  cloaking_gate: "Cloaking gate",
  destination_resolution: "Destination resolution",
  render: "In-app render",
};

export function BoundaryTable({ recon }: { recon: Reconciliation }) {
  // One row per boundary present on the graph's nodes.
  const boundaries = [...new Set(
    recon.nodes.map((n) => n.node.boundary).filter((b): b is string => !!b),
  )];
  if (boundaries.length === 0) return null;
  return (
    <div className="overflow-x-auto">
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="text-left font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">
          <th className="py-1">Boundary</th><th>Status</th><th>Node</th><th>Concrete API</th>
        </tr>
      </thead>
      <tbody>
        {boundaries.map((b) => {
          const n = recon.nodes.find((x) => x.node.boundary === b)!;
          const tone = n.status === "confirmed" ? "green" : n.status === "failed" ? "red" : "amber";
          return (
            <tr key={b} className="border-t border-edge-faint align-top">
              <td className="py-1.5 pr-2 text-ink-secondary">{BOUNDARY_LABEL[b] ?? b}</td>
              <td className="pr-2"><StatusChip tone={tone} dot label={n.status} /></td>
              <td className="pr-2 font-mono text-[11px] text-ink-muted">{n.node.node_id}</td>
              <td className="font-mono text-[11px] text-ink-muted">{n.node.signature.class_name}.{n.node.signature.method.split("(")[0]}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
