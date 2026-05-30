import type {
  MissionContext,
  EvidenceReturn,
  FlowNode,
  NodeEvidence,
  NativeFile,
  NodeConfirmation,
  Verdict,
  KnownRiskwareUrl,
} from "./contract";
import {
  effectiveNodeStatus,
  chainVerdict,
  chainConfirmed,
  investigationScore,
  scoreAfterOverride,
  type EffectiveStatus,
} from "./score";
import { lookupUrl, lookupDomain, domainOf, normalizeUrl } from "./known-urls";

// =====================================================================
// Read model. Reconciles Yoda's static graph + Vader's evidence + any human
// calls into one view the UI renders. Reused by /yoda, /vader, and the
// reconciled card.
// =====================================================================

export type ReconciledNode = {
  node: FlowNode;
  evidence?: NodeEvidence;
  nativeFile?: NativeFile; // Vader's confirmed native file when present
  status: EffectiveStatus; // effective, including human override
  isRequired: boolean;
  humanCall?: NodeConfirmation;
};

export type UrlIntel = {
  url: string;
  domain: string;
  urlKnown: boolean;
  urlEntry?: KnownRiskwareUrl;
  domainKnown: boolean;
  domainEntries: KnownRiskwareUrl[];
};

export type ReconcileOptions = {
  humanConfirmations?: Record<string, NodeConfirmation>;
  verdictOverride?: Verdict;
  // when false, the dynamic (Vader) side is hidden — e.g. Yoda before send
  includeDynamic?: boolean;
};

export type Band = { phase: string; title: string; nodes: ReconciledNode[] };

export type Reconciliation = {
  nodes: ReconciledNode[];
  bands: Band[];
  requiredNodes: string[];
  requiredConfirmedCount: number;
  agentVerdict: Verdict;
  effectiveVerdict: Verdict;
  confirmed: boolean;
  score: number;
  maxScore: number;
  urlIntel?: UrlIntel;
};

// Phase → human band title. The flow's `phase` field drives banding; an
// unknown phase falls back to a title-cased version of the key.
const PHASE_TITLES: Record<string, string> = {
  lifecycle: "Lifecycle & SDK setup",
  acquisition: "Acquire attribution signal",
  cloaking_gate: "Cloaking gate",
  url_resolution: "Resolve destination URL",
  render: "Render in WebView",
};

function phaseTitle(phase: string): string {
  return PHASE_TITLES[phase] ?? phase.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function reconcile(
  mission: MissionContext,
  evidence: EvidenceReturn | undefined,
  opts: ReconcileOptions = {},
): Reconciliation {
  const useDynamic = opts.includeDynamic !== false;
  const ev = useDynamic ? evidence : undefined;
  const evByNode = new Map((ev?.node_evidence ?? []).map((e) => [e.node_id, e]));
  const nativeById = new Map((ev?.native_files ?? []).map((n) => [n.native_id, n]));

  const nodes: ReconciledNode[] = mission.flow.nodes.map((node) => {
    const nodeEv = evByNode.get(node.node_id);
    const humanCall = opts.humanConfirmations?.[node.node_id];
    const status = effectiveNodeStatus(node, nodeEv, humanCall);
    let nativeFile = node.native_file;
    if (nativeFile && nativeById.has(nativeFile.native_id)) {
      nativeFile = nativeById.get(nativeFile.native_id);
    }
    return {
      node,
      evidence: nodeEv,
      nativeFile,
      status,
      isRequired: mission.flow.required_nodes.includes(node.node_id),
      humanCall,
    };
  });

  // Band by phase, preserving first-seen order across the node list.
  const phaseOrder: string[] = [];
  for (const n of nodes) {
    const p = n.node.phase ?? "other";
    if (!phaseOrder.includes(p)) phaseOrder.push(p);
  }
  const bands: Band[] = phaseOrder.map((phase) => ({
    phase,
    title: phaseTitle(phase),
    nodes: nodes.filter((n) => (n.node.phase ?? "other") === phase),
  }));

  const chain = {
    ioc_id: mission.rubric.chain_id,
    points_if_strong: mission.rubric.points_if_strong,
    graph: mission.flow,
    evidence: ev?.node_evidence ?? [],
    humanConfirmations: opts.humanConfirmations,
  };

  const agentVerdict = chainVerdict(chain);
  const confirmed = chainConfirmed(chain);
  const effectiveVerdict = opts.verdictOverride ?? agentVerdict;
  const requiredConfirmedCount = nodes.filter(
    (n) => n.isRequired && n.status === "confirmed",
  ).length;

  const score = opts.verdictOverride
    ? scoreAfterOverride(mission.rubric.points_if_strong, opts.verdictOverride)
    : investigationScore([chain]).total;

  // URL intel for the produces_url node (drives the known-URL badge).
  let urlIntel: UrlIntel | undefined;
  const urlNode = nodes.find((n) => n.node.produces_url);
  if (urlNode) {
    const produced =
      ev?.found_urls?.[0] ??
      urlNode.node.decryptor?.decrypted_strings.find((s) =>
        s.plaintext.startsWith("http"),
      )?.plaintext;
    if (produced) {
      const u = lookupUrl(produced);
      const dom = domainOf(produced);
      const d = lookupDomain(dom);
      urlIntel = {
        url: normalizeUrl(produced),
        domain: dom,
        urlKnown: u.known,
        urlEntry: u.entry,
        domainKnown: d.known,
        domainEntries: d.entries,
      };
    }
  }

  return {
    nodes,
    bands,
    requiredNodes: mission.flow.required_nodes,
    requiredConfirmedCount,
    agentVerdict,
    effectiveVerdict,
    confirmed,
    score,
    maxScore: mission.rubric.points_if_strong,
    urlIntel,
  };
}
