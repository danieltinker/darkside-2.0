"use client";
import { ClusterCanvas } from "@/brain/components/ClusterCanvas";
import type { BrainModel } from "@/brain/types";
export function BrainBoard({ model }: { model: BrainModel }) {
  return (
    <div className="h-screen w-screen">
      <ClusterCanvas model={model} onOpenSignal={(id) => console.log("open", id)} />
    </div>
  );
}
