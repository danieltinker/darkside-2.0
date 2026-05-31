import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { KIND_STYLE } from "@/brain/palette";

export function AttackNode({ data }: { data: any }) {
  const [open, setOpen] = useState(false);
  const ring = data.isRequired ? "ring-2 ring-accent-cyan/70" : "";
  const dashed = data.mock ? "border-dashed" : "";
  return (
    <div
      className={`w-[260px] rounded-lg border bg-bg-card/90 p-2.5 shadow ${KIND_STYLE[data.kind as keyof typeof KIND_STYLE]} ${ring} ${dashed}`}
      onClick={() => setOpen((o) => !o)}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
        <span>{data.kind}</span>
        {data.isEntry && <span className="text-accent-green">entry</span>}
        {data.isRequired && <span className="text-accent-cyan">required</span>}
      </div>
      <div className="mt-0.5 text-[12px] font-medium leading-tight text-zinc-100">{data.label}</div>
      <div className="font-mono text-[10px] text-zinc-500">{data.phase}{data.boundary ? ` · ${data.boundary}` : ""}</div>
      {open && (
        <div className="mt-2 space-y-1 border-t border-zinc-700/50 pt-2 font-mono text-[10px] text-zinc-300">
          {data.behavioralRole && <div>role: {data.behavioralRole}</div>}
          <div>static_confirmed: {String(data.staticConfirmed ?? "—")}</div>
          {data.fridaHook && <div className="break-all">hook: {data.fridaHook}</div>}
          {data.signature ? (
            <div className="break-all">
              <div>{data.signature.className}.{data.signature.method}</div>
              <div className="text-zinc-500">{data.signature.filePath}:{data.signature.line}</div>
              <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-1 text-[9px] text-zinc-300">{data.signature.snippet}</pre>
            </div>
          ) : (
            <div className="text-amber-400">no signature (mock)</div>
          )}
        </div>
      )}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
