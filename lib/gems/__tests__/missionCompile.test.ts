import { describe, it, expect } from "vitest";
import { compileMission, mintMissionId, getCompiledMission } from "@/lib/gems/goldenMission";
import type { CaseIdentity, QueueLock } from "@/lib/contract";

describe("mission compilation scales to more rubrics / packages / versions", () => {
  it("getCompiledMission stays the golden fixture (m_8821, strong 8, same boundaries)", () => {
    const m = getCompiledMission();
    expect(m.mission_id).toBe("m_8821");
    expect(m.rubric.points_if_strong).toBe(8);
    expect(m.flow.required_nodes).toEqual(["n4_callback", "n6_gate", "n8_resolve", "n10_load"]);
  });

  it("mintMissionId is unique per (package, version) and stable", () => {
    const a = mintMissionId("com.x", 1);
    const b = mintMissionId("com.x", 2);
    expect(a).toMatch(/^m_[0-9a-f]{10}$/);
    expect(a).not.toBe(b); // different version → different mission id
    expect(a).toBe(mintMissionId("com.x", 1)); // deterministic
  });

  it("compileMission builds a valid mission for another version of the SAME package — distinct id (coexists)", () => {
    const identity: CaseIdentity = {
      case_id: "c2",
      package_name: "com.coinflip.rewards",
      version_code: 185,
      version_name: "3.4.2",
      developer: "Nimbus Rewards Ltd.",
      top_countries: ["US"],
    };
    const lock: QueueLock = { lock_id: "QL-2", case_id: "c2", locked_by: "yoda", locked_at: "", expires_at: "" };
    const id = mintMissionId(identity.package_name, identity.version_code);
    const m = compileMission({
      rubricId: "attribution_gated_webview_uncloaking",
      caseIdentity: identity,
      queueLock: lock,
      missionId: id,
    });
    expect(m.mission_id).toBe(id);
    expect(m.mission_id).not.toBe("m_8821"); // v3.4.2 ≠ the golden v3.4.1 → no bridge collision
    expect(m.rubric.points_if_strong).toBe(8);
    expect(m.flow.required_nodes).toHaveLength(4);
    expect(m.case_identity.version_code).toBe(185);
  });

  it("compiling a rubric with no traced graph.yaml fails loudly (can't send a mission for it yet)", () => {
    const identity: CaseIdentity = {
      case_id: "c3", package_name: "com.y", version_code: 1, version_name: "1.0", developer: "y", top_countries: [],
    };
    const lock: QueueLock = { lock_id: "QL-3", case_id: "c3", locked_by: "yoda", locked_at: "", expires_at: "" };
    expect(() =>
      compileMission({ rubricId: "device_info_cloaking", caseIdentity: identity, queueLock: lock, missionId: "m_x" }),
    ).toThrow(); // signal-level rubric has no graph.yaml — author one before tracing it
  });
});
