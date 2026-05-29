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

export type Band = { stage: 1 | 2 | 3; title: string; nodes: ReconciledNode[] };

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

const STAGE_TITLES: Record<1 | 2 | 3, string> = {
  1: "Trigger",
  2: "URL build",
  3: "Sink",
};

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

  const bands: Band[] = ([1, 2, 3] as const).map((stage) => ({
    stage,
    title: STAGE_TITLES[stage],
    nodes: nodes.filter((n) => n.node.stage === stage),
  }));

  const chain = {
    ioc_id: mission.ioc.ioc_id,
    points_if_strong: mission.ioc.points_if_strong,
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
    ? scoreAfterOverride(mission.ioc.points_if_strong, opts.verdictOverride)
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
    maxScore: mission.ioc.points_if_strong,
    urlIntel,
  };
}
