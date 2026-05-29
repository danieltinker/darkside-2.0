// FORWARD SCAFFOLDING (not yet wired into the live UI path).
// This is the multi-rubric aggregation layer: given each chain's already-computed
// binary confirmation, sum the confirmed chains into the app total. Yoda will call
// this once multiple rubrics exist. The current single-chain live scoring lives in
// lib/score.ts (investigationScore / scoreAfterOverride) and reconcile.ts; keep the
// binary-per-chain rule identical across both.

export type ChainResult = { chain_id: string; points: number; confirmed: boolean };

// Binary per chain: a chain contributes its full points only if fully confirmed,
// else 0. The app total is the sum of confirmed chains. (No partial credit.)
export function aggregateScore(chains: ChainResult[]): {
  total: number; max: number; perChain: ChainResult[];
} {
  return {
    total: chains.reduce((s, c) => s + (c.confirmed ? c.points : 0), 0),
    max: chains.reduce((s, c) => s + c.points, 0),
    perChain: chains,
  };
}
