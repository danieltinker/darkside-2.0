import {
  produceMission,
  produceEvidence,
  packMissionBundle,
  packEvidenceBundle,
  importBundle,
} from "@/lib/bridge-fs";
import { missionContext, evidenceReturn, artifactContent, extractedPayloads } from "@/lib/mock";

// Demo fast-forward for the bridge explorer: runs the FULL real round trip
// in-process — produce → pack → import → produce → pack → import — using the
// exact same pack/verify path a human-carried bundle would. No airgap is
// bypassed conceptually; it just skips the physical carry.
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Yoda produces + the mission bundle is carried to Vader and imported.
    await produceMission(missionContext);
    const missionBundle = await packMissionBundle(missionContext.mission_id);
    if (!missionBundle) throw new Error("failed to pack mission bundle");
    const importMission = await importBundle(missionBundle);

    // Vader runs + the evidence bundle is carried back to Yoda and imported.
    await produceEvidence(
      evidenceReturn,
      artifactContent,
      extractedPayloads.map((p) => ({ payloadStoragePath: p.storage_path })),
    );
    const evidenceBundle = await packEvidenceBundle(evidenceReturn.mission_id);
    if (!evidenceBundle) throw new Error("failed to pack evidence bundle");
    const importEvidence = await importBundle(evidenceBundle);

    return Response.json({ ok: true, importMission, importEvidence });
  } catch (err) {
    return Response.json({ error: String((err as Error).message) }, { status: 500 });
  }
}
