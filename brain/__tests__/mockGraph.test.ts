import { describe, it, expect } from "vitest";
import { mockGraph } from "@/brain/transform/mockGraph";
import type { NodeKind, EdgeRelation } from "@/brain/types";

const KINDS: NodeKind[] = ["trigger","dispatch","http","parse","deobf","sink","condition","benign_branch","assessment","verdict"];
const RELATIONS: EdgeRelation[] = ["calls","returns","data_to","triggers","initializes","registers","async_triggers","branch_benign","branch_uncloaked","resolves_or_requests","destination_to_container","loads"];

const sig = (id: string, strength: any = "strong") => ({ id, name: "n", strength, points: 8 as const });
const rub = (boundaries: string[] = []) => ({ requiredBoundaries: boundaries });

describe("mockGraph", () => {
  it("is flagged as a mock and references the chain id", () => {
    const g = mockGraph(sig("rubric__sig_a"), rub());
    expect(g.source).toBe("mock");
    expect(g.graphId).toContain("rubric__sig_a");
  });

  it("emits only valid node-kinds and edge-relations", () => {
    const g = mockGraph(sig("x__y"), rub(["acquisition", "gate", "sink"]));
    for (const n of g.nodes) expect(KINDS).toContain(n.kind);
    for (const e of g.edges) expect(RELATIONS).toContain(e.relation);
  });

  it("is deterministic for the same chain id", () => {
    const a = mockGraph(sig("dup__id"), rub(["a", "b"]));
    const b = mockGraph(sig("dup__id"), rub(["a", "b"]));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("entry points to a real node and edges connect real nodes", () => {
    const g = mockGraph(sig("z__z"), rub(["one", "two", "three"]));
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(ids.has(g.entry)).toBe(true);
    for (const e of g.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  it("marks at least one required node and lacks signatures", () => {
    const g = mockGraph(sig("a__b"), rub(["acq", "sink"]));
    expect(g.nodes.some((n) => n.isRequired)).toBe(true);
    expect(g.requiredNodes.length).toBeGreaterThan(0);
    for (const n of g.nodes) expect(n.signature).toBeUndefined();
  });

  it("scales node count with strength", () => {
    const strong = mockGraph(sig("s1", "strong"), rub());
    const weak = mockGraph(sig("s2", "weak"), rub());
    expect(strong.nodes.length).toBeGreaterThanOrEqual(weak.nodes.length);
  });
});
