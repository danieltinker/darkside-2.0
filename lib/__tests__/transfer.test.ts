import { describe, it, expect, beforeAll } from "vitest";
import {
  produceMission,
  produceEvidence,
  packMissionBundle,
  packEvidenceBundle,
  importBundle,
  getTransfers,
  markMissionDone,
  resetBridge,
} from "@/lib/bridge-fs";
import { getCompiledMission } from "@/lib/gems/goldenMission";
import { evidenceReturn, artifactContent, extractedPayloads, MISSION_ID } from "@/lib/mock";

describe("transfer integrity (uniqueness, completeness, ledger, dedup)", () => {
  let missionTid = "";
  let evidenceTid = "";

  beforeAll(async () => {
    await resetBridge();
    const mission = getCompiledMission();
    await produceMission(mission);
    await produceEvidence(
      evidenceReturn,
      artifactContent,
      extractedPayloads.map((p) => ({ payloadStoragePath: p.storage_path })),
    );
  });

  it("a mission bundle carries a unique transfer_id, package, version, and complete flag", async () => {
    const b = (await packMissionBundle(MISSION_ID))!;
    expect(b.manifest.transfer_id).toMatch(/^m_8821\.yoda\.[0-9a-f]{8}$/);
    expect(b.manifest.package_name).toBe("com.coinflip.rewards");
    expect(b.manifest.version_code).toBe(184);
    expect(b.manifest.complete).toBe(true);
    const r = await importBundle(b);
    missionTid = r.transfer_id;
    expect(r.duplicate).toBe(false);
    expect(r.complete).toBe(true);
  });

  it("re-importing the identical bundle is flagged as a DUPLICATE (not a silent overwrite)", async () => {
    const b = (await packMissionBundle(MISSION_ID))!;
    const r = await importBundle(b);
    expect(r.transfer_id).toBe(missionTid);
    expect(r.duplicate).toBe(true);
  });

  it("a tampered bundle is REJECTED wholesale (verify-then-write — nothing persisted)", async () => {
    const b = (await packEvidenceBundle(MISSION_ID))!;
    (b.evidence as { iterations: number }).iterations = 9999; // mutate after packing → checksum no longer matches
    const r = await importBundle(b);
    expect(r.ok).toBe(false);
    expect(r.checksum_ok).toBe(false);
    expect(r.artifacts_written).toBe(0);
    expect(r.errors.some((e) => /rejected|nothing written/i.test(e))).toBe(true);
  });

  it("an evidence bundle has its own transfer_id, distinct from the mission's", async () => {
    const b = (await packEvidenceBundle(MISSION_ID))!;
    expect(b.manifest.transfer_id).toMatch(/^m_8821\.vader\.[0-9a-f]{8}$/);
    expect(b.manifest.complete).toBe(evidenceReturn.dynamic_confirmed);
    const r = await importBundle(b);
    evidenceTid = r.transfer_id;
    expect(evidenceTid).not.toBe(missionTid);
  });

  it("the ledger records every transfer so Yoda knows what arrived + what's complete", async () => {
    const log = await getTransfers();
    expect(log.length).toBeGreaterThanOrEqual(3); // mission, mission(dup), evidence
    expect(log.filter((t) => t.kind === "mission").length).toBeGreaterThanOrEqual(2);
    expect(log.some((t) => t.transfer_id === evidenceTid && t.complete)).toBe(true);
    expect(log.some((t) => t.duplicate)).toBe(true);
  });

  it("marking a mission done flags every ledger entry for that mission_id", async () => {
    const updated = await markMissionDone(MISSION_ID, true);
    expect(updated).toBeGreaterThanOrEqual(3);
    expect((await getTransfers()).every((t) => t.done)).toBe(true);
    await markMissionDone(MISSION_ID, false);
    expect((await getTransfers()).some((t) => t.done)).toBe(false);
  });
});
