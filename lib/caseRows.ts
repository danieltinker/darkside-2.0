import "server-only";
import { loadChains } from "./gems/loadGem";
import { caseQueue, type CaseRecord } from "./cases";

// =====================================================================
// Server-side join: caseQueue (roster) × the rubric's chains (gem files) →
// per-case chain outcomes + a binary-per-chain score. Derived from the
// source-of-truth chains.yaml so the queue can never drift from the rubric.
// =====================================================================

export type ChainOutcome = {
  chain_id: string;
  name: string;
  strength: "strong" | "medium" | "weak" | "non_signal";
  points: 8 | 4 | 2 | 0;
  confirmed: boolean;
};

export type CaseRow = CaseRecord & {
  chains: ChainOutcome[];
  score: number; // sum of confirmed chains' points (binary per chain)
  max: number; // sum of all the rubric's chains' points
};

export function buildCaseRows(): CaseRow[] {
  return caseQueue.map((c) => {
    const chains = loadChains(c.rubric_id).chains;
    const confirmed = new Set(c.confirmed_chain_ids);
    const outcomes: ChainOutcome[] = chains.map((ch) => ({
      chain_id: ch.chain_id,
      name: ch.name,
      strength: ch.strength,
      points: ch.points,
      confirmed: confirmed.has(ch.chain_id),
    }));
    const score = outcomes.filter((o) => o.confirmed).reduce((s, o) => s + o.points, 0);
    const max = outcomes.reduce((s, o) => s + o.points, 0);
    return { ...c, chains: outcomes, score, max };
  });
}
