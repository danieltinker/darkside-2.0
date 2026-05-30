import type { QueueStatus } from "./cases";

// =====================================================================
// Case workbench VIEW logic (client-safe — no server imports).
//
// Enforces the real sequence of events so the UI never shows contradictory
// steps at once:
//   install + decompile (slice)  →  agent armed (waiting for dispatch)
//   → running static  →  DONE static  ← only now are chains/score the OUTPUT
//   → push to device  →  running dynamic  →  DONE dynamic (Vader)
//
// The chain breakdown is the RESULT of static analysis, so it is revealed only
// once the agent has finished static analysis — never alongside the
// "Install & Decompile" action.
// =====================================================================

export type AgentStatus =
  | "idle" // not started — needs install & decompile
  | "static_waiting" // armed (slice ok), waiting for manual dispatch
  | "static_running" // agent running static analysis
  | "static_done" // static analysis complete → chains/score are the output
  | "dynamic_running" // pushed to device → running dynamic investigation
  | "dynamic_done"; // dynamic investigation complete (Vader)

export const AGENT_LABEL: Record<AgentStatus, string> = {
  idle: "idle",
  static_waiting: "waiting for dispatch",
  static_running: "running · static analysis",
  static_done: "done · static analysis",
  dynamic_running: "running · dynamic investigation",
  dynamic_done: "done · dynamic investigation",
};

export const AGENT_TONE: Record<AgentStatus, "neutral" | "amber" | "cyan" | "violet" | "green"> = {
  idle: "neutral",
  static_waiting: "amber",
  static_running: "cyan",
  static_done: "green",
  dynamic_running: "violet",
  dynamic_done: "green",
};

// Chains/score are the OUTPUT of static analysis — reveal only once it's done.
export function revealsChains(s: AgentStatus): boolean {
  return s === "static_done" || s === "dynamic_running" || s === "dynamic_done";
}

const ANALYZED: QueueStatus[] = ["scored", "partial", "fp"];

// Baseline agent status implied by a seeded roster case when no live runtime
// overlay exists yet (so pre-analyzed demo cases render consistently).
export function baselineAgentStatus(status: QueueStatus, traced: boolean): AgentStatus {
  if (ANALYZED.includes(status)) return status === "scored" && traced ? "dynamic_done" : "static_done";
  if (status === "running") return "static_running";
  return "idle"; // below_gate / locked / fresh
}

// Was the APK installed on the device? Analyzed/running cases went through it.
export function baselineInstalled(status: QueueStatus): boolean {
  return ANALYZED.includes(status) || status === "running";
}

// A minimal shape of the runtime overlay this module needs (avoids importing
// the server-only store). The real CaseRuntime is a superset.
export type RuntimeView = {
  installed: boolean;
  agent_status: AgentStatus;
  decompile: "none" | "ok" | "failed";
} | undefined;

export function effectiveAgentStatus(status: QueueStatus, traced: boolean, rt: RuntimeView): AgentStatus {
  if (rt && rt.agent_status !== "idle") return rt.agent_status;
  if (rt && (rt.installed || rt.decompile !== "none")) return rt.agent_status; // mid-flight, explicit
  return baselineAgentStatus(status, traced);
}

export function effectiveInstalled(status: QueueStatus, rt: RuntimeView): boolean {
  return rt ? rt.installed : baselineInstalled(status);
}
