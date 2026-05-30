import { describe, it, expect } from "vitest";
import { fridaHookScript } from "@/lib/frida";
import { mmpCloakingGraph } from "@/lib/flow";

describe("fridaHookScript", () => {
  it("builds a Java.perform hook from a node's signature", () => {
    const cb = mmpCloakingGraph.nodes.find((n) => n.node_id === "n4_callback")!;
    const s = fridaHookScript(cb);
    expect(s).toContain("Java.perform(function ()");
    expect(s).toContain('Java.use("com.adtrack.attr.AttribListener")');
    expect(s).toContain("C.onConversionDataSuccess.implementation");
    expect(s).toContain(`// target: ${cb.frida_hook}`);
  });

  it("strips the method arg list and works for every traced node", () => {
    for (const n of mmpCloakingGraph.nodes) {
      const s = fridaHookScript(n);
      expect(s).toContain("Java.perform");
      expect(s).not.toContain(".implementation = function ()\n  const"); // well-formed
      expect(s).not.toMatch(/\.\(/); // no empty/garbled method like ".("
    }
  });
});
