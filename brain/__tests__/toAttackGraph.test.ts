import { describe, it, expect } from "vitest";
import { toAttackGraph } from "@/brain/transform/toAttackGraph";
import type { AttackGraphView } from "@/brain/types";

const g: AttackGraphView = {
  graphId: "g1",
  entry: "n1",
  requiredNodes: ["n2"],
  source: "traced",
  nodes: [
    { id: "n1", label: "Launch", kind: "trigger", phase: "p1", isRequired: false },
    { id: "n2", label: "Gate", kind: "condition", phase: "p2", isRequired: true,
      signature: { className: "C", method: "m()", filePath: "f.java", line: 9, snippet: "x" } },
  ],
  edges: [{ from: "n1", to: "n2", relation: "branch_uncloaked", label: "status==NonOrg" }],
};

describe("toAttackGraph", () => {
  const { nodes, edges } = toAttackGraph(g);

  it("preserves node + edge counts", () => {
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(1);
  });

  it("marks required nodes and carries the signature", () => {
    const n2 = nodes.find((n) => n.id === "n2")!;
    expect((n2.data as any).isRequired).toBe(true);
    expect((n2.data as any).signature.line).toBe(9);
  });

  it("preserves relation + label on edges", () => {
    expect((edges[0] as any).label).toBe("status==NonOrg");
    expect((edges[0].data as any).relation).toBe("branch_uncloaked");
  });
});
