import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AgentStatus } from "./caseView";

export type { AgentStatus };

// =====================================================================
// Case runtime status — the dynamic overlay on the static roster (lib/cases.ts).
// Disk-backed (like the bridge) so the Queue and the Agent tab share one source
// of truth and it survives a reload. Drives the human-in-the-loop flow:
//
//   Install & Decompile  →  installed + sliced (100%)  →  agent: STATIC analysis
//        (on a below-gate case this is a human GATE ESCALATION)
//   Push to device (PixelBridge, fs synced)            →  agent: DYNAMIC analysis
//
// A slice that isn't 100% sets decompile="failed" and does NOT activate the
// agent (Sky Walker won't hook a bad slice).
// =====================================================================

export type DecompileState = "none" | "ok" | "failed";

export type CaseEvent = { at: string; kind: string; detail: string };

export type CaseRuntime = {
  case_id: string;
  escalated: boolean; // a human overrode the metadata gate
  installed: boolean;
  decompile: DecompileState;
  device_synced: boolean;
  agent_status: AgentStatus;
  events: CaseEvent[];
};

const STORE = path.join(process.cwd(), "bridge", "case-status.json");

export function defaultRuntime(caseId: string): CaseRuntime {
  return {
    case_id: caseId,
    escalated: false,
    installed: false,
    decompile: "none",
    device_synced: false,
    agent_status: "idle",
    events: [],
  };
}

type StoreShape = { version: 1; cases: Record<string, CaseRuntime> };

async function read(): Promise<StoreShape> {
  try {
    return JSON.parse(await fs.readFile(STORE, "utf8")) as StoreShape;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, cases: {} };
    throw err;
  }
}

async function write(store: StoreShape): Promise<void> {
  await fs.mkdir(path.dirname(STORE), { recursive: true });
  const tmp = `${STORE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2));
  await fs.rename(tmp, STORE);
}

export async function readAllRuntime(): Promise<Record<string, CaseRuntime>> {
  return (await read()).cases;
}

export async function getRuntime(caseId: string): Promise<CaseRuntime> {
  return (await read()).cases[caseId] ?? defaultRuntime(caseId);
}

async function mutate(caseId: string, fn: (rt: CaseRuntime) => void): Promise<CaseRuntime> {
  const store = await read();
  const rt = store.cases[caseId] ?? defaultRuntime(caseId);
  fn(rt);
  store.cases[caseId] = rt;
  await write(store);
  return rt;
}

function event(rt: CaseRuntime, kind: string, detail: string) {
  rt.events.push({ at: new Date().toISOString(), kind, detail });
}

// Install the APK + decompile ("slice"). `belowGate` marks a human gate
// escalation. `sliceOk=false` simulates a failed decompile (agent NOT armed).
export async function installAndDecompile(
  caseId: string,
  opts: { belowGate?: boolean; sliceOk?: boolean } = {},
): Promise<CaseRuntime> {
  const sliceOk = opts.sliceOk ?? true;
  return mutate(caseId, (rt) => {
    if (opts.belowGate && !rt.escalated) {
      rt.escalated = true;
      event(rt, "escalate", "human override — metadata below gate, forcing review");
    }
    rt.installed = true;
    event(rt, "install", "adb install <pkg> → installed on device");
    if (sliceOk) {
      rt.decompile = "ok";
      rt.agent_status = "static_waiting"; // armed; awaiting MANUAL dispatch (no auto-dispatch)
      event(rt, "slice", "full decompile (slice) 100% — agent armed, waiting for dispatch (static)");
    } else {
      rt.decompile = "failed";
      rt.agent_status = "idle";
      event(rt, "slice_failed", "decompilation failed — agent NOT armed (Sky Walker needs a 100% slice)");
    }
  });
}

// Uninstall the APK from the device (placeholder — real adb uninstall plugs in
// here). Resets to needs-install; the host-side slice is unaffected.
export async function uninstall(caseId: string): Promise<CaseRuntime> {
  return mutate(caseId, (rt) => {
    rt.installed = false;
    rt.device_synced = false;
    event(rt, "uninstall", "adb uninstall <pkg> → removed from device");
  });
}

// The analysis agent reports its own run-status (it calls this when it runs;
// surfaced as placeholder controls until the real agent is plugged in).
export async function agentReport(caseId: string, status: AgentStatus): Promise<CaseRuntime> {
  return mutate(caseId, (rt) => {
    rt.agent_status = status;
    event(rt, "agent", `agent reported: ${status.replace(/_/g, " ")}`);
  });
}

// Push the mission to the device over PixelBridge. The caller ensures the
// device filesystem is up to date first; this starts DYNAMIC investigation.
export async function pushToDevice(caseId: string, fsDetail: string): Promise<CaseRuntime> {
  return mutate(caseId, (rt) => {
    rt.device_synced = true;
    rt.agent_status = "dynamic_running";
    event(rt, "device_sync", fsDetail);
    event(rt, "dynamic", "pushed to device over PixelBridge — agent: running dynamic investigation");
  });
}

export async function resetRuntime(): Promise<void> {
  await write({ version: 1, cases: {} });
}
