import { Handle, Position } from "@xyflow/react";

export function RubricNode({ data }: { data: any }) {
  const specOnly = data.provenance === "spec_only";
  return (
    <div className={`w-[240px] rounded-xl border p-3 shadow ${specOnly ? "border-dashed border-zinc-500/60 bg-bg-elevated/50 opacity-80" : "border-accent-violet/60 bg-bg-elevated/90"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-accent-violet">rubric</span>
        <span className={`rounded px-1.5 py-0.5 text-[9px] ${specOnly ? "bg-zinc-600/30 text-zinc-300" : "bg-accent-violet/20 text-accent-violet"}`}>
          {specOnly ? "spec only" : "gem"}
        </span>
      </div>
      <div className="text-sm font-semibold">{data.name}</div>
      <div className="font-mono text-[10px] text-zinc-500">{data.rubricId}</div>
      <div className="mt-2 flex flex-wrap gap-1 font-mono text-[10px] text-zinc-300">
        <span className="rounded bg-zinc-700/40 px-1.5">{data.severity}</span>
        <span className="rounded bg-zinc-700/40 px-1.5">{data.signalCount} signals</span>
        {data.requiredBoundaries.length > 0 && (
          <span className="rounded bg-zinc-700/40 px-1.5">{data.requiredBoundaries.length} boundaries</span>
        )}
        {data.hasTraced && <span className="rounded bg-emerald-600/30 px-1.5 text-emerald-300">⬡ traced</span>}
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
