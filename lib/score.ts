import type {
  FlowGraph,
  FlowNode,
  NodeEvidence,
  NodeConfirmation,
  Verdict,
} from "./contract";

// =====================================================================
// Scoring — binary per IOC chain.
//
// A point is a claim about a CONFIRMED attack chain. Half a chain proves
// nothing, so within a chain scoring is all-or-nothing: the full
// static+dynamic chain confirmed → points_if_strong, anything missing → 0.
// Gradation ("partial") lives one level up, across independent chains of
// differing strength (8 / 4 / 2). The investigation score is the sum of
// confirmed chains. The MVP supplies exactly one 8-point chain; 4/2-point
// chains slot in here with no refactor.
// =====================================================================

export type EffectiveStatus = "confirmed" | "failed" | "pending";

// A node's effective status reconciles Yoda's static flag, Vader's dynamic
// status, and any human call. The human is authoritative (human-in-the-loop):
// a reject breaks the link, a confirm asserts it (still requires the static
// signature to have been located).
export function effectiveNodeStatus(
  node: FlowNode,
  evidence: NodeEvidence | undefined,
  humanCall?: NodeConfirmation,
): EffectiveStatus {
  if (humanCall === "rejected") return "failed";
  if (humanCall === "confirmed") return node.static_confirmed ? "confirmed" : "pending";
  if (!node.static_confirmed) return "pending";
  return evidence?.dynamic_status ?? "pending";
}

export type ChainInput = {
  ioc_id: string;
  points_if_strong: number; // 8 | 4 | 2
  graph: FlowGraph;
  evidence: NodeEvidence[];
  humanConfirmations?: Record<string, NodeConfirmation>;
};

function requiredStatuses(c: ChainInput): EffectiveStatus[] {
  return c.graph.required_nodes.map((id) => {
    const node = c.graph.nodes.find((n) => n.node_id === id);
    if (!node) return "pending";
    const ev = c.evidence.find((e) => e.node_id === id);
    return effectiveNodeStatus(node, ev, c.humanConfirmations?.[id]);
  });
}

export function requiredBreakdown(c: ChainInput): {
  confirmed: string[];
  failed: string[];
  pending: string[];
} {
  const confirmed: string[] = [];
  const failed: string[] = [];
  const pending: string[] = [];
  for (const id of c.graph.required_nodes) {
    const node = c.graph.nodes.find((n) => n.node_id === id);
    const ev = c.evidence.find((e) => e.node_id === id);
    const s = node
      ? effectiveNodeStatus(node, ev, c.humanConfirmations?.[id])
      : "pending";
    if (s === "confirmed") confirmed.push(id);
    else if (s === "failed") failed.push(id);
    else pending.push(id);
  }
  return { confirmed, failed, pending };
}

export function chainConfirmed(c: ChainInput): boolean {
  const s = requiredStatuses(c);
  return s.length > 0 && s.every((x) => x === "confirmed");
}

export function chainScore(c: ChainInput): number {
  return chainConfirmed(c) ? c.points_if_strong : 0;
}

// Agent (pre-human) verdict for a single chain.
export function chainVerdict(c: ChainInput): Verdict {
  const { failed, confirmed } = requiredBreakdown(c);
  if (confirmed.length === c.graph.required_nodes.length) return "confirmed_tp";
  if (failed.length > 0) return "failed_fp";
  return "partial";
}

// Human override recompute. confirmed_tp → full points, failed_fp → 0.
// For a single chain "partial" yields 0 (no fractional credit within a
// chain — gradation is cross-chain).
export function scoreAfterOverride(
  pointsIfStrong: number,
  override: Verdict,
): number {
  switch (override) {
    case "confirmed_tp":
      return pointsIfStrong;
    case "failed_fp":
      return 0;
    case "partial":
      return 0;
  }
}

export type InvestigationScore = {
  total: number;
  max: number;
  perChain: {
    ioc_id: string;
    points_if_strong: number;
    awarded: number;
    confirmed: boolean;
  }[];
};

// Sum of confirmed chains. MVP = one 8-chain → total is 8 or 0. With future
// 4/2-point chains, total < max but > 0 reads as a partial investigation.
export function investigationScore(chains: ChainInput[]): InvestigationScore {
  const perChain = chains.map((c) => {
    const confirmed = chainConfirmed(c);
    return {
      ioc_id: c.ioc_id,
      points_if_strong: c.points_if_strong,
      awarded: confirmed ? c.points_if_strong : 0,
      confirmed,
    };
  });
  return {
    total: perChain.reduce((s, p) => s + p.awarded, 0),
    max: perChain.reduce((s, p) => s + p.points_if_strong, 0),
    perChain,
  };
}
