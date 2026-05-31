import "server-only";
import { loadCategory, loadGraphGem } from "@/lib/gems/loadGem";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { RISKWARE_TAXONOMY } from "@/brain/data/riskwareTaxonomy";
import { RUBRIC_ID_MAP } from "@/brain/data/rubricIdMap";
import { mockGraph } from "@/brain/transform/mockGraph";
import { pointsForStrength } from "@/brain/types";
import type {
  BrainModel, CategoryView, RubricView, SignalView,
  AttackGraphView, AttackNodeView, AttackEdgeView, NodeKind, EdgeRelation,
  Provenance,
} from "@/brain/types";
import type { GraphGem } from "@/lib/gems/types";

const GEMS = path.join(process.cwd(), "gems");

const PROVENANCE_BY_ID: Record<string, Provenance> = Object.fromEntries(
  Object.values(RUBRIC_ID_MAP).map((r) => [r.id, r.provenance]),
);

// Which traced graphs exist today, keyed by rubric_id → the chain they belong to.
const TRACED: Record<string, { chainName: string }> = {
  attribution_gated_webview_uncloaking: {
    chainName: "App loads affiliate link into a Webview w/ conversion data",
  },
};

interface RubricYaml {
  name?: string;
  description?: string;
  severity?: string;
  points_if_strong?: number;
  required_behavioral_boundaries?: string[];
}

function readRubricYaml(rubricId: string): RubricYaml | undefined {
  try {
    return parse(readFileSync(path.join(GEMS, `riskware/rubrics/${rubricId}/rubric.yaml`), "utf8")) as RubricYaml;
  } catch {
    return undefined;
  }
}

function gemToAttackGraph(gem: GraphGem): AttackGraphView {
  const required = new Set(gem.required_nodes);
  const nodes: AttackNodeView[] = gem.nodes.map((n) => ({
    id: n.node_id,
    label: n.label,
    kind: n.kind as NodeKind,
    phase: n.phase,
    boundary: n.boundary ?? null,
    behavioralRole: n.behavioral_role,
    isRequired: required.has(n.node_id),
    staticConfirmed: n.static_confirmed,
    fridaHook: n.frida_hook,
    signature: {
      className: n.signature.class_name,
      method: n.signature.method,
      filePath: n.signature.file_path,
      line: n.signature.line,
      snippet: n.signature.snippet,
    },
  }));
  const edges: AttackEdgeView[] = gem.edges.map((e) => ({
    from: e.from,
    to: e.to,
    relation: e.relation as EdgeRelation,
    label: e.label,
  }));
  return { graphId: gem.graph_id, entry: gem.entry, requiredNodes: gem.required_nodes, nodes, edges, source: "traced" };
}

// Derive a severity for spec_only rubrics from their strongest signal.
function deriveSeverity(strengths: string[]): string {
  if (strengths.includes("strong")) return "high";
  if (strengths.includes("medium")) return "medium";
  return "low";
}

export function loadModel(): BrainModel {
  const gemCat = loadCategory("riskware");

  // Pre-load the one traced graph once.
  const tracedGem = loadGraphGem("attribution_gated_webview_uncloaking");
  const tracedView = gemToAttackGraph(tracedGem);

  const rubrics: RubricView[] = RISKWARE_TAXONOMY.map((tr) => {
    const provenance: Provenance = PROVENANCE_BY_ID[tr.id] ?? "spec_only";
    const ry = provenance === "gem" ? readRubricYaml(tr.id) : undefined;
    const requiredBoundaries = ry?.required_behavioral_boundaries ?? [];

    const signals: SignalView[] = tr.signals.map((s) => {
      const traced = TRACED[tr.id]?.chainName === s.name;
      const attackGraph: AttackGraphView = traced
        ? tracedView
        : mockGraph({ id: s.id, name: s.name, strength: s.strength }, { requiredBoundaries });
      return {
        id: s.id,
        name: s.name,
        strength: s.strength,
        points: pointsForStrength(s.strength),
        requiredNodes: attackGraph.requiredNodes,
        attackGraph,
      };
    });

    return {
      id: tr.id,
      name: ry?.name ?? tr.name,
      description: ry?.description ?? tr.description,
      severity: ry?.severity?.split(/\s+/)[0] ?? deriveSeverity(tr.signals.map((s) => s.strength)),
      pointsIfStrong: ry?.points_if_strong ?? 8,
      requiredBoundaries,
      provenance,
      signals,
    };
  });

  // Fail loudly if a TRACED entry's chainName drifted from the taxonomy signal
  // name (otherwise every signal would silently fall back to a mock).
  const tracedCount = rubrics
    .flatMap((r) => r.signals)
    .filter((s) => s.attackGraph.source === "traced").length;
  const expectedTracedCount = Object.keys(TRACED).length;
  if (tracedCount !== expectedTracedCount) {
    throw new Error(
      `loadModel: expected ${expectedTracedCount} traced graph(s) but resolved ${tracedCount}. ` +
      `Check TRACED chainName values match the taxonomy signal names exactly.`,
    );
  }

  const category: CategoryView = {
    id: gemCat.category_id,
    name: gemCat.name,
    version: gemCat.version,
    status: gemCat.status,
    dispatchGate: gemCat.dispatch_gate.metadata_score_gte,
    scoring: {
      strong: gemCat.scoring_model.strong,
      medium: gemCat.scoring_model.medium,
      weak: gemCat.scoring_model.weak,
      confirmedTp: gemCat.scoring_model.confirmed_tp_threshold,
    },
    rubrics,
  };

  return { categories: [category] };
}
