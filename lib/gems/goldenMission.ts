import "server-only";
import { createHash } from "node:crypto";
import type { CaseIdentity, MissionContext, QueueLock } from "@/lib/contract";
import { caseIdentity, queueLock, MISSION_ID } from "@/lib/mock";
import { stampMission } from "@/lib/bridge";
import { loadGraphGem, loadChains, loadCategory } from "./loadGem";
import { compileFlowGraph } from "./compileMission";

// =====================================================================
// Mission compilation. compileMission() builds a MissionContext for ANY traced
// rubric + case (this is what scales to more rubrics/packages live).
// getCompiledMission() is the GOLDEN FIXTURE — compileMission pinned to the demo
// rubric/case/id, kept byte-identical so existing bridge state + tests are stable.
// =====================================================================

const GOLDEN_RUBRIC = "attribution_gated_webview_uncloaking";

// Unique, stable mission id per (package, version) so the bridge can hold many
// missions without collision. The golden fixture keeps its legacy literal id.
export function mintMissionId(packageName: string, versionCode: number): string {
  return `m_${createHash("sha256").update(`${packageName}@${versionCode}`).digest("hex").slice(0, 10)}`;
}

export type CompileMissionOpts = {
  rubricId: string;
  caseIdentity: CaseIdentity;
  queueLock: QueueLock;
  missionId: string;
  rubricName?: string;
  mockResponses?: { label: string; when: string; payload: unknown }[];
  createdAt?: string;
};

export function compileMission(opts: CompileMissionOpts): MissionContext {
  const cat = loadCategory("riskware"); // single category in this MVP
  const chains = loadChains(opts.rubricId).chains;
  // The headline chain is the TRACED one (it carries required_nodes); fall back to chains[0].
  const chain = chains.find((c) => c.required_nodes && c.required_nodes.length) ?? chains[0];
  const flow = compileFlowGraph(loadGraphGem(opts.rubricId)); // throws if the rubric has no graph.yaml

  // The mission's headline chain must be a scored signal (8/4/2), never non_signal(0).
  const points = chain.points;
  if (points === 0) throw new Error(`mission chain ${chain.chain_id} is non_signal`);

  const aids = {
    frida_hooks: flow.nodes.map((n) => ({ node_id: n.node_id, target: n.frida_hook })),
    mock_responses: opts.mockResponses ?? [],
    decryptors: flow.nodes.flatMap((n) => (n.decryptor ? [n.decryptor] : [])),
  };

  return stampMission({
    schema_version: "1.0.0",
    type: "MissionContext",
    mission_id: opts.missionId,
    sent_by: "yoda",
    sent_to: "darth_vader",
    case_identity: opts.caseIdentity,
    queue_lock: opts.queueLock,
    rubric: {
      category_id: cat.category_id,
      rubric_id: opts.rubricId,
      chain_id: chain.chain_id,
      name: opts.rubricName ?? chain.name,
      points_if_strong: points,
      gem_version: cat.version,
    },
    dynamic_aids: aids,
    flow,
    status: "MISSION_SENT",
    created_at: opts.createdAt ?? new Date().toISOString(),
  });
}

// The golden demo mission — compileMission pinned to the fixture (id, case, aids,
// created_at) so its output (and checksum) is unchanged.
export function getCompiledMission(): MissionContext {
  return compileMission({
    rubricId: GOLDEN_RUBRIC,
    caseIdentity,
    queueLock,
    missionId: MISSION_ID,
    rubricName: "Attribution-Gated WebView Uncloaking",
    mockResponses: [
      {
        label: "tracker GET response (carries wrapped URL)",
        when: "non_organic attribution",
        payload: { status: "ok", dl: "S0NmW1tdQ0pYW0FUX0ZRXl5dQ0pYW0FUX0ZR" },
      },
    ],
    createdAt: "2026-05-29T08:02:00Z",
  });
}
