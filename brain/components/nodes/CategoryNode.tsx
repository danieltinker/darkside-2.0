import { Handle, Position } from "@xyflow/react";

export function CategoryNode({ data }: { data: any }) {
  return (
    <div className="w-[240px] rounded-xl border border-accent-cyan/60 bg-bg-elevated/90 p-3 shadow-lg">
      <div className="text-[10px] uppercase tracking-wider text-accent-cyan">category</div>
      <div className="text-sm font-semibold">{data.name}</div>
      <div className="mt-1 text-[11px] text-zinc-400">v{data.version} · {data.status}</div>
      <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[10px] text-zinc-300">
        <span>gate ≥ {data.dispatchGate}</span>
        <span>{data.rubricCount} rubrics</span>
        <span>S{data.scoring.strong}/M{data.scoring.medium}/W{data.scoring.weak}</span>
        <span>TP ≥ {data.scoring.confirmedTp}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
