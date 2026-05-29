import type { MissionContext } from "@/lib/contract";
import { StatusChip } from "./StatusChip";

export function DynamicAids({ aids }: { aids: NonNullable<MissionContext["dynamic_aids"]> }) {
  const hooks = aids.frida_hooks ?? [];
  const mocks = aids.mock_responses ?? [];
  const decs = aids.decryptors ?? [];
  if (!hooks.length && !mocks.length && !decs.length) return null;
  return (
    <div className="mb-5 rounded-xl border border-yoda/30 bg-yoda/[0.04] p-4">
      <div className="mb-2 flex items-center gap-2">
        <StatusChip tone="green" label="Sky Walker aids" />
        <span className="font-mono text-[11px] text-ink-muted">
          static findings to accelerate this run
        </span>
      </div>
      <div className="grid gap-3 font-mono text-[11px] text-ink-secondary sm:grid-cols-3">
        <div>
          <div className="text-ink-faint">frida hooks</div>
          <div className="text-[14px] text-ink-primary">{hooks.length}</div>
        </div>
        <div>
          <div className="text-ink-faint">mock responses</div>
          <div className="text-[14px] text-ink-primary">{mocks.length}</div>
          {mocks.map((m, i) => (
            <div key={i} className="mt-0.5 text-ink-muted">{m.label}</div>
          ))}
        </div>
        <div>
          <div className="text-ink-faint">decryptors</div>
          <div className="text-[14px] text-ink-primary">
            {decs.map((d) => d.algorithm).join(", ") || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
