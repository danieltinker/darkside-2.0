import type { MissionContext, EvidenceReturn } from "./contract";
import { checksumHex } from "./util";

// =====================================================================
// Contract message integrity — the checksum layer of PixelBridge.
//
// The REAL transport lives in lib/bridge-fs.ts (server-only filesystem) +
// the /api/bridge/* route handlers. This module holds only the browser- and
// server-safe stamp/verify helpers used to seal each contract message: the
// checksum is computed over the payload with the `checksum` field removed,
// so a message can be verified byte-for-byte after crossing the airgap on the
// device.
// =====================================================================

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
