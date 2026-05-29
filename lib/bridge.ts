import type { MissionContext, EvidenceReturn } from "./contract";
import { checksumHex } from "./util";

// =====================================================================
// PixelBridge — the simulated append-only transfer between the two
// machines. Append-only, idempotent by mission_id, checksum on every
// message. For the MVP the transport is an in-memory store; the shapes and
// statuses are the real contract a two-machine build would honor unchanged.
//
//   bridge/yoda_outbox  <mission_id>.MissionContext.json   (A→B)
//   bridge/vader_inbox  (mirror of yoda_outbox)
//   bridge/vader_outbox <mission_id>.EvidenceReturn.json   (B→A)
//   bridge/yoda_inbox   (mirror of vader_outbox)
// =====================================================================

type BridgeState = {
  yoda_outbox: Map<string, MissionContext>;
  vader_inbox: Map<string, MissionContext>;
  vader_outbox: Map<string, EvidenceReturn>;
  yoda_inbox: Map<string, EvidenceReturn>;
};

const state: BridgeState = {
  yoda_outbox: new Map(),
  vader_inbox: new Map(),
  vader_outbox: new Map(),
  yoda_inbox: new Map(),
};

// Checksum is computed over the payload with the checksum field removed.
function payloadChecksum<T extends { checksum: string }>(msg: T): string {
  const { checksum: _omit, ...rest } = msg;
  return checksumHex(JSON.stringify(rest));
}

export function stampMission(m: Omit<MissionContext, "checksum">): MissionContext {
  const withEmpty = { ...m, checksum: "" } as MissionContext;
  return { ...withEmpty, checksum: payloadChecksum(withEmpty) };
}

export function stampEvidence(e: Omit<EvidenceReturn, "checksum">): EvidenceReturn {
  const withEmpty = { ...e, checksum: "" } as EvidenceReturn;
  return { ...withEmpty, checksum: payloadChecksum(withEmpty) };
}

export function verifyChecksum(msg: MissionContext | EvidenceReturn): boolean {
  return payloadChecksum(msg) === msg.checksum;
}

// ---- A→B : Yoda sends the mission ----------------------------------
export function sendMission(m: MissionContext): void {
  // write .tmp then atomic rename → here just an idempotent Map set by id
  state.yoda_outbox.set(m.mission_id, m);
  state.vader_inbox.set(m.mission_id, m); // mirror
}

export function readMissionForVader(mission_id: string): MissionContext | undefined {
  return state.vader_inbox.get(mission_id);
}

// ---- B→A : Vader returns the evidence ------------------------------
export function sendEvidence(e: EvidenceReturn): void {
  state.vader_outbox.set(e.mission_id, e);
  state.yoda_inbox.set(e.mission_id, e); // mirror
}

export function readEvidenceForYoda(mission_id: string): EvidenceReturn | undefined {
  return state.yoda_inbox.get(mission_id);
}

export function hasEvidence(mission_id: string): boolean {
  return state.yoda_inbox.has(mission_id);
}
