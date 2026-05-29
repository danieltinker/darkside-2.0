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
      points_if_strong: chain.points,
      gem_version: cat.version,
    },
    flow,
    status: "MISSION_SENT",
    created_at: "2026-05-29T08:02:00Z",
  });
}
