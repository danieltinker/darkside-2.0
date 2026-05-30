import { describe, it, expect, beforeEach } from "vitest";
import {
  installAndDecompile,
  pushToDevice,
  getRuntime,
  resetRuntime,
} from "@/lib/caseStatus";

describe("case runtime status (human-in-the-loop)", () => {
  beforeEach(async () => {
    await resetRuntime();
  });

  it("install & decompile arms the STATIC agent", async () => {
    const rt = await installAndDecompile("case_test_a");
    expect(rt.installed).toBe(true);
    expect(rt.decompile).toBe("ok");
    expect(rt.agent_status).toBe("static");
    expect(rt.events.some((e) => e.kind === "slice")).toBe(true);
  });

  it("a below-gate escalation is recorded", async () => {
    const rt = await installAndDecompile("case_test_b", { belowGate: true });
    expect(rt.escalated).toBe(true);
    expect(rt.events.some((e) => e.kind === "escalate")).toBe(true);
    expect(rt.agent_status).toBe("static");
  });

  it("a failed slice does NOT arm the agent", async () => {
    const rt = await installAndDecompile("case_test_c", { sliceOk: false });
    expect(rt.decompile).toBe("failed");
    expect(rt.agent_status).toBe("idle");
  });

  it("pushing to device flips STATIC → DYNAMIC and syncs the device fs", async () => {
    await installAndDecompile("case_test_d");
    const rt = await pushToDevice("case_test_d", "device filesystem synchronized");
    expect(rt.device_synced).toBe(true);
    expect(rt.agent_status).toBe("dynamic");
    expect(await getRuntime("case_test_d")).toMatchObject({ agent_status: "dynamic" });
  });
});
