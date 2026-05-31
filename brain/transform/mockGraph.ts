import type { AttackGraphView, AttackNodeView, AttackEdgeView, NodeKind, Strength } from "@/brain/types";

interface SigLike { id: string; name: string; strength: Strength }
interface RubLike { requiredBoundaries: string[] }

// node count by strength — strong flows are richer than supporting ones.
const NODES_BY_STRENGTH: Record<Strength, number> = { strong: 5, medium: 4, weak: 3, non_signal: 2 };

// a plausible kind progression for a generic uncloaking/loading flow.
const SKELETON_KINDS: NodeKind[] = ["trigger", "dispatch", "condition", "deobf", "sink"];

function kindForIndex(i: number, total: number): NodeKind {
  if (i === 0) return "trigger";
  if (i === total - 1) return "sink";
  return SKELETON_KINDS[Math.min(i, SKELETON_KINDS.length - 2)] ?? "dispatch";
}

// Build nodes: one per required boundary when present, else a strength-scaled skeleton.
function buildMockNodes(sig: SigLike, rub: RubLike): AttackNodeView[] {
  const phases = rub.requiredBoundaries.length
    ? rub.requiredBoundaries
    : Array.from({ length: NODES_BY_STRENGTH[sig.strength] }, (_, i) => `stage_${i + 1}`);

  const total = phases.length;
  return phases.map((phase, i) => {
    const kind = kindForIndex(i, total);
    // required = the gate-like condition and the terminal sink (the scoring boundaries).
    const isRequired = kind === "condition" || kind === "sink" || (total <= 2 && i === total - 1);
    return {
      id: `${sig.id}__n${i + 1}`,
      label: `${phase} (mock)`,
      kind,
      phase,
      boundary: rub.requiredBoundaries.length ? phase : null,
      isRequired,
    };
  });
}

export function mockGraph(sig: SigLike, rub: RubLike): AttackGraphView {
  const nodes = buildMockNodes(sig, rub);
  const edges: AttackEdgeView[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const next = nodes[i + 1];
    const relation = next.kind === "sink" ? "loads"
      : next.kind === "condition" ? "branch_uncloaked"
      : next.kind === "deobf" ? "data_to"
      : "calls";
    edges.push({ from: nodes[i].id, to: next.id, relation });
  }
  const requiredNodes = nodes.filter((n) => n.isRequired).map((n) => n.id);
  // guarantee at least one required node (the terminal) for degenerate flows.
  if (requiredNodes.length === 0 && nodes.length) {
    nodes[nodes.length - 1].isRequired = true;
    requiredNodes.push(nodes[nodes.length - 1].id);
  }
  return {
    graphId: `mock__${sig.id}`,
    entry: nodes[0]?.id ?? `${sig.id}__n1`,
    requiredNodes,
    nodes,
    edges,
    source: "mock",
  };
}
