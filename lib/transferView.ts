import type { TransferLogEntry } from "./bridge-fs";

// =====================================================================
// Multi-package view over the flat transfer ledger (client-safe — type-only
// import). Groups transfers by package → mission, so the bridge can show and
// manage MANY packages, surface 2-versions-of-one-package as a coexisting
// (non-blocking) conflict, and flag duplicate carries.
// =====================================================================

export type MissionView = {
  mission_id: string;
  version_code?: number;
  version_name?: string;
  transfers: TransferLogEntry[];
  hasMission: boolean;
  hasEvidence: boolean;
  complete: boolean; // evidence came back complete → investigation has its payload
  duplicate: boolean; // a re-carry of identical content was seen
  done: boolean; // operator marked the investigation complete
};

export type PackageGroup = {
  package_name: string;
  missions: MissionView[];
  versionCount: number; // distinct version_codes seen
  conflict: boolean; // >1 distinct version/instance of the same package — coexist, manage
};

export function groupTransfers(log: TransferLogEntry[]): PackageGroup[] {
  const byPkg = new Map<string, Map<string, TransferLogEntry[]>>();
  for (const t of log) {
    const pkg = t.package_name ?? "(unknown)";
    if (!byPkg.has(pkg)) byPkg.set(pkg, new Map());
    const missions = byPkg.get(pkg)!;
    if (!missions.has(t.mission_id)) missions.set(t.mission_id, []);
    missions.get(t.mission_id)!.push(t);
  }

  const groups: PackageGroup[] = [];
  for (const [package_name, missionMap] of byPkg) {
    const missions: MissionView[] = [];
    for (const [mission_id, transfers] of missionMap) {
      missions.push({
        mission_id,
        version_code: transfers.find((t) => t.version_code != null)?.version_code,
        version_name: transfers.find((t) => t.version_name)?.version_name,
        transfers,
        hasMission: transfers.some((t) => t.kind === "mission"),
        hasEvidence: transfers.some((t) => t.kind === "evidence"),
        complete: transfers.some((t) => t.kind === "evidence" && t.complete),
        duplicate: transfers.some((t) => t.duplicate),
        done: transfers.some((t) => t.done),
      });
    }
    const versionCount = new Set(missions.map((m) => m.version_code ?? m.mission_id)).size;
    groups.push({
      package_name,
      missions,
      versionCount,
      conflict: missions.length > 1 || versionCount > 1,
    });
  }
  return groups;
}
