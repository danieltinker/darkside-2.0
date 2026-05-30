import type { FlowNode } from "./contract";

// =====================================================================
// Frida hook script generator (review aid).
//
// Produces a representative Frida JS hook for a node from its signature /
// hook target, so a human reviewer can read — and copy — the exact
// instrumentation that would confirm the node at runtime. This is a
// readable reconstruction, not the byte-for-byte script Vader ran.
// =====================================================================

export function fridaHookScript(node: FlowNode): string {
  const sig = node.signature;
  const target = node.frida_hook;
  // class = signature class, else everything before the final .#/method in the hook target
  const cls = sig?.class_name ?? target.replace(/[.#][^.#]*$/, "");
  // method = signature method (strip its arg list), else the final segment of the target
  const method = (sig?.method ?? target.split(/[.#]/).pop() ?? "method").replace(/\(.*$/, "");

  return [
    "// Auto-generated review hook — darkside",
    `// node: ${node.node_id} (${node.kind})`,
    `// target: ${target}`,
    "Java.perform(function () {",
    `  const C = Java.use(${JSON.stringify(cls)});`,
    `  C.${method}.implementation = function () {`,
    "    const args = Array.prototype.slice.call(arguments);",
    `    console.log("[hook] ${cls}.${method} <-", JSON.stringify(args));`,
    "    const ret = this." + method + ".apply(this, arguments);",
    `    console.log("[hook] ${cls}.${method} ->", ret);`,
    "    return ret;",
    "  };",
    "});",
    "",
  ].join("\n");
}
