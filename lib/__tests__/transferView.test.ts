import { describe, it, expect } from "vitest";
import { groupTransfers } from "@/lib/transferView";
import type { TransferLogEntry } from "@/lib/bridge-fs";

const e = (over: Partial<TransferLogEntry>): TransferLogEntry => ({
  transfer_id: "t",
  kind: "mission",
  mission_id: "m",
  package_name: "com.x",
  version_code: 1,
  version_name: "1.0",
  producer: "yoda",
  created_at: "",
  imported_at: "",
  complete: false,
  checksum_ok: true,
  artifacts_verified: 0,
  duplicate: false,
  done: false,
  ...over,
});

describe("groupTransfers (multi-package view)", () => {
  it("two versions of the SAME package coexist as one group flagged conflict", () => {
    const log = [
      e({ mission_id: "m_v1", version_code: 184, version_name: "3.4.1", transfer_id: "a" }),
      e({ mission_id: "m_v2", version_code: 185, version_name: "3.4.2", transfer_id: "b" }),
    ];
    const groups = groupTransfers(log);
    expect(groups).toHaveLength(1);
    expect(groups[0].package_name).toBe("com.x");
    expect(groups[0].missions).toHaveLength(2);
    expect(groups[0].versionCount).toBe(2);
    expect(groups[0].conflict).toBe(true);
  });

  it("a single mission with both legs is complete when evidence is complete", () => {
    const log = [
      e({ kind: "mission", transfer_id: "m1" }),
      e({ kind: "evidence", transfer_id: "e1", complete: true }),
    ];
    const group = groupTransfers(log)[0];
    expect(group.conflict).toBe(false); // one package, one version
    const m = group.missions[0];
    expect(m.hasMission).toBe(true);
    expect(m.hasEvidence).toBe(true);
    expect(m.complete).toBe(true);
  });

  it("duplicate carry aggregates onto the mission; distinct packages don't merge", () => {
    const log = [
      e({ package_name: "com.a", transfer_id: "x" }),
      e({ package_name: "com.a", transfer_id: "x", duplicate: true }),
      e({ package_name: "com.b", mission_id: "mb", transfer_id: "y" }),
    ];
    const groups = groupTransfers(log);
    expect(groups).toHaveLength(2);
    const a = groups.find((g) => g.package_name === "com.a")!;
    expect(a.conflict).toBe(false); // same version, just a re-carry
    expect(a.missions[0].duplicate).toBe(true);
  });
});
