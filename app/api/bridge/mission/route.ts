import { produceMission } from "@/lib/bridge-fs";
import { getCompiledMission } from "@/lib/gems/goldenMission";

// Yoda produces the MissionContext into bridge/yoda_outbox. The MissionContext
// is now compiled from gem files rather than hardcoded.
export const dynamic = "force-dynamic";

export async function POST() {
  const mission = getCompiledMission();
  await produceMission(mission);
  return Response.json({
    ok: true,
    mission_id: mission.mission_id,
    checksum: mission.checksum,
  });
}
