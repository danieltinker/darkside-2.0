import "server-only";
import type { MissionContext } from "@/lib/contract";
import { caseIdentity, queueLock, MISSION_ID } from "@/lib/mock";
import { stampMission } from "@/lib/bridge";
import { loadGraphGem, loadChains, loadCategory } from "./loadGem";
import { compileFlowGraph } from "./compileMission";

const RUBRIC = "attribution_gated_webview_uncloaking";

// Compile the golden MissionContext from the gem files (replaces the hardcoded one).
export function getCompiledMission(): MissionContext {
  const cat = loadCategory("riskware");
  const chain = loadChains(RUBRIC).chains[0];
  const flow = compileFlowGraph(loadGraphGem(RUBRIC));

  // The mission's headline chain must be a scored signal (8/4/2), never non_signal(0).
  const points = chain.points;
  if (points === 0) throw new Error(`golden mission chain ${chain.chain_id} is non_signal`);

  const aids = {
    frida_hooks: flow.nodes.map((n) => ({ node_id: n.node_id, target: n.frida_hook })),
    mock_responses: [
      {
        label: "tracker GET response (carries wrapped URL)",
        when: "non_organic attribution",
        payload: { status: "ok", dl: "S0NmW1tdQ0pYW0FUX0ZRXl5dQ0pYW0FUX0ZR" },
      },
    ],
    decryptors: flow.nodes.flatMap((n) => (n.decryptor ? [n.decryptor] : [])),
  };

  return stampMission({
    schema_version: "1.0.0",
    type: "MissionContext",
    mission_id: MISSION_ID,
    sent_by: "yoda",
    sent_to: "darth_vader",
    case_identity: caseIdentity,
    queue_lock: queueLock,
    rubric: {
      category_id: cat.category_id,
      rubric_id: RUBRIC,
      chain_id: chain.chain_id,
      name: "Attribution-Gated WebView Uncloaking",
      points_if_strong: points,
      gem_version: cat.version,
    },
    dynamic_aids: aids,
    flow,
    status: "MISSION_SENT",
    created_at: "2026-05-29T08:02:00Z",
  });
}
