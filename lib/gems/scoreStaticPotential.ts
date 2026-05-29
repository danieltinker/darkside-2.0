// Static potential is a ROUTING GATE only — it never awards rubric points.
// weights come from search_strategy.yaml; `found` is the set of matched signal keys.
export function scoreStaticPotential(
  weights: Record<string, number>,
  found: string[],
  threshold: number,
): { score: number; qualifies_for_vader: boolean } {
  const score = found.reduce((s, k) => s + (weights[k] ?? 0), 0);
  return { score, qualifies_for_vader: score >= threshold };
}
