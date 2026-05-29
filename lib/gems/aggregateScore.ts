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
