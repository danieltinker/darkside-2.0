import { describe, it, expect, beforeEach } from "vitest";
import {
  installAndDecompile,
  pushToDevice,
  uninstall,
  agentReport,
  getRuntime,
  resetRuntime,
} from "@/lib/caseStatus";

describe("case runtime status (human-in-the-loop sequence)", () => {
  beforeEach(async () => {
    await resetRuntime();
  });

  it("install & decompile arms the agent (waiting for dispatch — NOT auto-run)", async () => {
    const rt = await installAndDecompile("case_test_a");
    expect(rt.installed).toBe(true);
    expect(rt.decompile).toBe("ok");
    expect(rt.agent_status).toBe("static_waiting");
    expect(rt.events.some((e) => e.kind === "slice")).toBe(true);
  });

  it("a below-gate escalation is recorded", async () => {
    const rt = await installAndDecompile("case_test_b", { belowGate: true });
    expect(rt.escalated).toBe(true);
    expect(rt.events.some((e) => e.kind === "escalate")).toBe(true);
    expect(rt.agent_status).toBe("static_waiting");
  });

  it("a failed slice does NOT arm the agent", async () => {
    const rt = await installAndDecompile("case_test_c", { sliceOk: false });
    expect(rt.decompile).toBe("failed");
    expect(rt.agent_status).toBe("idle");
  });

  it("the agent reports running → done static", async () => {
    await installAndDecompile("case_test_e");
    expect((await agentReport("case_test_e", "static_running")).agent_status).toBe("static_running");
    expect((await agentReport("case_test_e", "static_done")).agent_status).toBe("static_done");
  });

  it("pushing to device starts DYNAMIC and syncs the device fs", async () => {
    await installAndDecompile("case_test_d");
    await agentReport("case_test_d", "static_done");
    const rt = await pushToDevice("case_test_d", "device filesystem synchronized");
    expect(rt.device_synced).toBe(true);
    expect(rt.agent_status).toBe("dynamic_running");
    expect((await agentReport("case_test_d", "dynamic_done")).agent_status).toBe("dynamic_done");
  });

  it("uninstall removes the APK from the device", async () => {
    await installAndDecompile("case_test_f");
    const rt = await uninstall("case_test_f");
    expect(rt.installed).toBe(false);
    expect(rt.events.some((e) => e.kind === "uninstall")).toBe(true);
    expect(await getRuntime("case_test_f")).toMatchObject({ installed: false });
  });
});
