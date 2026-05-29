import { produceMission } from "@/lib/bridge-fs";
import { missionContext } from "@/lib/mock";

// Yoda produces the MissionContext into bridge/yoda_outbox. The golden case is
// the source of truth for the MVP; a real build would assemble this from the
// analyst's static findings.
export const dynamic = "force-dynamic";

export async function POST() {
  await produceMission(missionContext);
  return Response.json({
    ok: true,
    mission_id: missionContext.mission_id,
    checksum: missionContext.checksum,
  });
}
