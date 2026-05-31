import { describe, it, expect } from "vitest";
import { loadModel } from "@/brain/adapter/loadModel";

describe("loadModel", () => {
  const model = loadModel();
  const cat = model.categories[0];

  it("has one riskware category with the gem scoring/gate", () => {
    expect(model.categories).toHaveLength(1);
    expect(cat.id).toBe("riskware");
    expect(cat.dispatchGate).toBe(8);
    expect(cat.scoring.strong).toBe(8);
  });

  it("has 10 rubrics and 44 signals", () => {
    expect(cat.rubrics).toHaveLength(10);
    const signals = cat.rubrics.reduce((n, r) => n + r.signals.length, 0);
    expect(signals).toBe(44);
  });

  it("flags 5 gem and 5 spec_only rubrics", () => {
    expect(cat.rubrics.filter((r) => r.provenance === "gem")).toHaveLength(5);
    expect(cat.rubrics.filter((r) => r.provenance === "spec_only")).toHaveLength(5);
  });

  it("attaches exactly one traced graph and 43 mocks", () => {
    const all = cat.rubrics.flatMap((r) => r.signals);
    expect(all.filter((s) => s.attackGraph.source === "traced")).toHaveLength(1);
    expect(all.filter((s) => s.attackGraph.source === "mock")).toHaveLength(43);
  });

  it("the traced graph is the MMP strong-8 chain with real signatures", () => {
    const mmp = cat.rubrics.find((r) => r.id === "attribution_gated_webview_uncloaking")!;
    const traced = mmp.signals.find((s) => s.attackGraph.source === "traced")!;
    expect(traced.attackGraph.nodes.length).toBeGreaterThanOrEqual(10);
    expect(traced.attackGraph.nodes.some((n) => n.signature)).toBe(true);
  });

  it("every signal has a graph whose edges connect real nodes", () => {
    for (const r of cat.rubrics)
      for (const s of r.signals) {
        const ids = new Set(s.attackGraph.nodes.map((n) => n.id));
        expect(ids.has(s.attackGraph.entry)).toBe(true);
        for (const e of s.attackGraph.edges) {
          expect(ids.has(e.from)).toBe(true);
          expect(ids.has(e.to)).toBe(true);
        }
      }
  });
});
