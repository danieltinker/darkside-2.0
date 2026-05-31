import { describe, it, expect } from "vitest";
import { toClusterGraph } from "@/brain/transform/toClusterGraph";
import { loadModel } from "@/brain/adapter/loadModel";

describe("toClusterGraph", () => {
  const { nodes, edges } = toClusterGraph(loadModel());

  it("emits 1 category + 10 rubric + 44 signal nodes", () => {
    const byType = (t: string) => nodes.filter((n) => n.type === t).length;
    expect(byType("category")).toBe(1);
    expect(byType("rubric")).toBe(10);
    expect(byType("signal")).toBe(44);
    expect(nodes).toHaveLength(55);
  });

  it("wires category→rubric (10) and rubric→signal (44) edges", () => {
    expect(edges).toHaveLength(54);
    for (const e of edges) {
      expect(nodes.some((n) => n.id === e.source)).toBe(true);
      expect(nodes.some((n) => n.id === e.target)).toBe(true);
    }
  });

  it("carries provenance on rubric nodes and source on signal nodes", () => {
    const rubric = nodes.find((n) => n.type === "rubric")!;
    expect(["gem", "spec_only"]).toContain((rubric.data as any).provenance);
    const signal = nodes.find((n) => n.type === "signal")!;
    expect(["traced", "mock"]).toContain((signal.data as any).graphSource);
  });
});
