import type { NodeKind, EdgeRelation, Strength } from "@/brain/types";

// Border + text tone per node kind (Tailwind classes; tokens from app/globals.css).
export const KIND_STYLE: Record<NodeKind, string> = {
  trigger: "border-accent-green/50 text-accent-green",
  dispatch: "border-accent-cyan/50 text-accent-cyan",
  http: "border-accent-amber/50 text-accent-amber",
  parse: "border-accent-amber/50 text-accent-amber",
  deobf: "border-accent-violet/50 text-accent-violet",
  sink: "border-rose-400/60 text-rose-300",
  condition: "border-yellow-400/60 text-yellow-300",
  benign_branch: "border-emerald-400/50 text-emerald-300",
  assessment: "border-accent-cyan/40 text-accent-cyan",
  verdict: "border-fuchsia-400/60 text-fuchsia-300",
};

// Mirrors components/CallGraph.tsx RELATION_TONE.
export const RELATION_TONE: Record<EdgeRelation, string> = {
  calls: "text-accent-cyan",
  returns: "text-accent-violet",
  data_to: "text-accent-amber",
  triggers: "text-accent-green",
  initializes: "text-accent-cyan",
  registers: "text-accent-cyan",
  async_triggers: "text-accent-green",
  branch_benign: "text-emerald-400",
  branch_uncloaked: "text-rose-400",
  resolves_or_requests: "text-accent-amber",
  destination_to_container: "text-accent-violet",
  loads: "text-accent-violet",
};

// Strength chip styling for signal nodes.
export const STRENGTH_CHIP: Record<Strength, string> = {
  strong: "bg-rose-500/15 text-rose-300 border-rose-400/40",
  medium: "bg-amber-500/15 text-amber-300 border-amber-400/40",
  weak: "bg-sky-500/15 text-sky-300 border-sky-400/40",
  non_signal: "bg-zinc-500/15 text-zinc-400 border-zinc-400/30",
};
