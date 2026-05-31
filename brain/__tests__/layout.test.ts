import { describe, it, expect } from "vitest";
import { layoutGraph } from "@/brain/transform/layout";

const nodes = [
  { id: "a", type: "x", data: {}, position: { x: 0, y: 0 } },
  { id: "b", type: "x", data: {}, position: { x: 0, y: 0 } },
  { id: "c", type: "x", data: {}, position: { x: 0, y: 0 } },
];
const edges = [
  { id: "a-b", source: "a", target: "b" },
  { id: "b-c", source: "b", target: "c" },
];

describe("layoutGraph", () => {
  it("assigns distinct positions to every node", () => {
    const out = layoutGraph(nodes as any, edges as any, "TB");
    const ys = out.map((n) => n.position.y);
    expect(new Set(out.map((n) => `${n.position.x},${n.position.y}`)).size).toBe(3);
    expect(Math.max(...ys)).toBeGreaterThan(Math.min(...ys)); // ranked vertically
  });

  it("is deterministic", () => {
    const a = layoutGraph(nodes as any, edges as any, "LR");
    const b = layoutGraph(nodes as any, edges as any, "LR");
    expect(a.map((n) => n.position)).toEqual(b.map((n) => n.position));
  });
});
