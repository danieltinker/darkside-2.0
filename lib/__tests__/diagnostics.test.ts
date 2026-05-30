import { describe, it, expect } from "vitest";
import { runDiagnostics } from "@/lib/diagnostics";

describe("runDiagnostics (full end-to-end flow)", () => {
  it("every step passes and the golden reconciliation scores strong 8", async () => {
    const report = await runDiagnostics();
    const notPassed = report.steps
      .filter((s) => s.status !== "pass")
      .map((s) => `${s.id}: ${s.error ?? s.status}`);
    expect(notPassed, notPassed.join("; ")).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.summary.failed).toBe(0);

    const reconcileStep = report.steps.find((s) => s.id === "score.reconcile");
    expect(reconcileStep?.detail?.score).toBe(8);
    expect(reconcileStep?.detail?.verdict).toBe("confirmed_tp");
  });

  it("reports environment + a step for each stage of the round-trip", async () => {
    const report = await runDiagnostics();
    expect(report.env.node).toMatch(/^v\d+/);
    const ids = report.steps.map((s) => s.id);
    for (const id of ["gems.category", "mission.compile", "bridge.importEvidence", "score.reconcile"]) {
      expect(ids).toContain(id);
    }
  });
});
