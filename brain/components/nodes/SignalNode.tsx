import { Handle, Position } from "@xyflow/react";
import { STRENGTH_CHIP } from "@/brain/palette";

export function SignalNode({ data }: { data: any }) {
  const mock = data.graphSource === "mock";
  return (
    <div className="w-[240px] cursor-pointer rounded-lg border border-zinc-600/60 bg-bg-card/80 p-2.5 shadow transition hover:border-accent-cyan/70">
      <div className="flex items-center justify-between">
        <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${STRENGTH_CHIP[data.strength as keyof typeof STRENGTH_CHIP]}`}>
          {data.strength} · {data.points}
        </span>
        <span className={`text-[9px] ${mock ? "text-amber-400" : "text-emerald-400"}`}>{mock ? "mock" : "traced"}</span>
      </div>
      <div className="mt-1 text-[12px] leading-tight">{data.name}</div>
      <Handle type="target" position={Position.Left} />
    </div>
  );
}
