import { produceEvidence } from "@/lib/bridge-fs";
import { evidenceReturn, artifactContent, extractedPayloads } from "@/lib/mock";

// Vader runs the dynamic experiments and materializes the evidence as REAL
// files under bridge/artifacts/<id>/, then writes the EvidenceReturn into
// bridge/vader_outbox.
export const dynamic = "force-dynamic";

export async function POST() {
  const res = await produceEvidence(
    evidenceReturn,
    artifactContent,
    extractedPayloads.map((p) => ({ payloadStoragePath: p.storage_path })),
  );
  return Response.json({
    ok: true,
    mission_id: evidenceReturn.mission_id,
    checksum: evidenceReturn.checksum,
    artifactCount: res.artifactCount,
  });
}
