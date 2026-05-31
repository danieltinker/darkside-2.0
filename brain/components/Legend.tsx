import { STRENGTH_CHIP } from "@/brain/palette";

export function Legend() {
  const strengths = ["strong", "medium", "weak", "non_signal"] as const;
  return (
    <div className="rounded-lg border border-zinc-700/60 bg-bg-card/95 p-3 text-[10px]">
      <div className="mb-1 uppercase tracking-wider text-zinc-400">legend</div>
      <div className="flex flex-wrap gap-1">
        {strengths.map((s) => (
          <span key={s} className={`rounded border px-1.5 py-0.5 ${STRENGTH_CHIP[s]}`}>{s}</span>
        ))}
      </div>
      <div className="mt-2 flex gap-2 text-zinc-300">
        <span className="text-emerald-400">⬡ traced</span>
        <span className="text-amber-400">mock</span>
        <span className="text-zinc-400">dashed = spec only</span>
      </div>
    </div>
  );
}
