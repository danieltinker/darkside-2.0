"use client";

import type { BrainModel } from "@/brain/types";

export function BrainBoard({ model }: { model: BrainModel }) {
  const cat = model.categories[0];
  const signals = cat.rubrics.reduce((n, r) => n + r.signals.length, 0);
  const traced = cat.rubrics.flatMap((r) => r.signals).filter((s) => s.attackGraph.source === "traced").length;
  return (
    <div className="p-8 font-mono text-sm">
      <h1 className="mb-4 text-lg text-accent-cyan">brain · family clustering</h1>
      <p>category: {cat.name}</p>
      <p>rubrics: {cat.rubrics.length} · signals: {signals}</p>
      <p>traced graphs: {traced} · mock graphs: {signals - traced}</p>
    </div>
  );
}
