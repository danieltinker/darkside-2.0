// UI-facing view model for the brain board. Plain JSON-serializable types
// (no class instances, no functions) so a server component can pass them to a
// client component as props. Decoupled from lib/gems zod schemas on purpose.

export type Strength = "strong" | "medium" | "weak" | "non_signal";
export type Points = 8 | 4 | 2 | 0;
export type Provenance = "gem" | "spec_only";
export type GraphSource = "traced" | "mock";

const STRENGTH_POINTS: Record<Strength, Points> = {
  strong: 8,
  medium: 4,
  weak: 2,
  non_signal: 0,
};

export function pointsForStrength(s: Strength): Points {
  return STRENGTH_POINTS[s];
}

export interface BrainModel {
  categories: CategoryView[];
}

export interface CategoryView {
  id: string;
  name: string;
  version: string;
  status: string;
  dispatchGate: number;
  scoring: { strong: number; medium: number; weak: number; confirmedTp: number };
  rubrics: RubricView[];
}

export interface RubricView {
  id: string;
  name: string;
  description: string;
  severity: string;
  pointsIfStrong: number;
  requiredBoundaries: string[];
  provenance: Provenance;
  signals: SignalView[];
}

export interface SignalView {
  id: string;
  name: string;
  strength: Strength;
  points: Points;
  requiredNodes: string[];
  attackGraph: AttackGraphView; // always present: real traced graph, or generated mock
}

export interface AttackGraphView {
  graphId: string;
  entry: string;
  requiredNodes: string[];
  nodes: AttackNodeView[];
  edges: AttackEdgeView[];
  source: GraphSource;
}

// The 10 node-kinds and 12 edge-relations are the real gem vocabulary.
export type NodeKind =
  | "trigger" | "dispatch" | "http" | "parse" | "deobf" | "sink"
  | "condition" | "benign_branch" | "assessment" | "verdict";

export type EdgeRelation =
  | "calls" | "returns" | "data_to" | "triggers" | "initializes" | "registers"
  | "async_triggers" | "branch_benign" | "branch_uncloaked"
  | "resolves_or_requests" | "destination_to_container" | "loads";

export interface AttackNodeView {
  id: string;
  label: string;
  kind: NodeKind;
  phase: string;
  boundary?: string | null;
  behavioralRole?: string;
  isRequired: boolean;
  staticConfirmed?: boolean;
  fridaHook?: string;
  signature?: { className: string; method: string; filePath: string; line: number; snippet: string };
}

export interface AttackEdgeView {
  from: string;
  to: string;
  relation: EdgeRelation;
  label?: string;
}
