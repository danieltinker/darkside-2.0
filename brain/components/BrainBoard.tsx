"use client";

import { useCallback, useMemo, useState } from "react";
import type { BrainModel, Strength } from "@/brain/types";
import { ClusterCanvas } from "@/brain/components/ClusterCanvas";
import { AttackCanvas } from "@/brain/components/AttackCanvas";
import { Legend } from "@/brain/components/Legend";
import { FilterBar, type Filters } from "@/brain/components/FilterBar";

export function BrainBoard({ model }: { model: BrainModel }) {
  const [openSignalId, setOpenSignalId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    strengths: new Set<Strength>(["strong", "medium", "weak", "non_signal"]),
    gemOnly: false,
  });

  const handleBack = useCallback(() => setOpenSignalId(null), []);

  // Apply filters to a shallow-cloned model (drops signals/rubrics that don't match).
  const filtered = useMemo<BrainModel>(() => {
    const categories = model.categories.map((cat) => ({
      ...cat,
      rubrics: cat.rubrics
        .filter((r) => (filters.gemOnly ? r.provenance === "gem" : true))
        .map((r) => ({ ...r, signals: r.signals.filter((s) => filters.strengths.has(s.strength)) }))
        .filter((r) => r.signals.length > 0),
    }));
    return { categories };
  }, [model, filters]);

  // Find the open signal + its rubric across the (unfiltered) model.
  const open = useMemo(() => {
    if (!openSignalId) return null;
    for (const cat of model.categories)
      for (const rub of cat.rubrics) {
        const sig = rub.signals.find((s) => s.id === openSignalId);
        if (sig) return { rubric: rub, signal: sig };
      }
    return null;
  }, [model, openSignalId]);

  return (
    <div className="flex h-screen w-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="font-mono text-sm text-accent-cyan">
          brain · family clustering
          <span className="ml-2 text-zinc-500">
            {open ? "› attack graph" : "› riskware clusters"}
          </span>
        </div>
        {!open && <FilterBar filters={filters} onChange={setFilters} />}
      </header>

      <div className="relative flex-1">
        {open ? (
          <AttackCanvas rubric={open.rubric} signal={open.signal} onBack={handleBack} />
        ) : (
          <ClusterCanvas model={filtered} onOpenSignal={setOpenSignalId} />
        )}
        {!open && (
          <div className="absolute bottom-4 right-4">
            <Legend />
          </div>
        )}
      </div>
    </div>
  );
}
