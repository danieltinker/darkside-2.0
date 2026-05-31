"use client";

import type { Strength } from "@/brain/types";

export interface Filters { strengths: Set<Strength>; gemOnly: boolean }

export function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const all: Strength[] = ["strong", "medium", "weak", "non_signal"];
  const toggle = (s: Strength) => {
    const next = new Set(filters.strengths);
    next.has(s) ? next.delete(s) : next.add(s);
    onChange({ ...filters, strengths: next });
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-bg-card/95 p-2 text-[11px]">
      <span className="text-zinc-400">filter:</span>
      {all.map((s) => (
        <button
          key={s}
          onClick={() => toggle(s)}
          className={`rounded px-2 py-0.5 ${filters.strengths.has(s) ? "bg-accent-cyan/30 text-accent-cyan" : "bg-zinc-700/40 text-zinc-400"}`}
        >
          {s}
        </button>
      ))}
      <button
        onClick={() => onChange({ ...filters, gemOnly: !filters.gemOnly })}
        className={`rounded px-2 py-0.5 ${filters.gemOnly ? "bg-accent-violet/30 text-accent-violet" : "bg-zinc-700/40 text-zinc-400"}`}
      >
        gem only
      </button>
    </div>
  );
}
