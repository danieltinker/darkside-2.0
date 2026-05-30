import "server-only";

import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

import type { MissionContext, EvidenceReturn } from "./contract";
import { verifyChecksum } from "./bridge";
import type { ArtifactContent } from "./mock";

// =====================================================================
// PixelBridge — REAL filesystem transport (airgapped, device-folder model).
//
// Each machine runs its own copy of the app with its own bridge/ directory
// on its own disk. NOTHING crosses the airgap except a single, self-contained
// bundle file the operator downloads on one machine and carries on the device
// (USB / AirDrop) to import on the other. The on-disk mailboxes are what each
// dashboard renders from — so each machine extracts evidence locally.
//
//   bridge/yoda_outbox/<id>.MissionContext.json    Yoda produced → carried out
//   bridge/vader_inbox/<id>.MissionContext.json    imported on Vader's machine
//   bridge/vader_outbox/<id>.EvidenceReturn.json   Vader produced → carried out
//   bridge/yoda_inbox/<id>.EvidenceReturn.json     imported on Yoda's machine
//   bridge/artifacts/<id>/...                       real frida/http/shot/payload files
//   bridge/artifacts/<id>/_content.json             renderable artifact content
//
// Writes are atomic (write .tmp then rename). Contract messages carry a
// checksum verified on every read; bundle artifacts carry a real sha256
// verified on import. Idempotent by mission_id.
// =====================================================================

const ROOT = process.cwd();
const BRIDGE = path.join(ROOT, "bridge");

export type Role = "yoda" | "vader";

const MISSION_FILE = (id: string) => `${id}.MissionContext.json`;
const EVIDENCE_FILE = (id: string) => `${id}.EvidenceReturn.json`;

// ---- low-level fs helpers ------------------------------------------
function realSha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function atomicWrite(file: string, data: Buffer | string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file); // atomic on the same filesystem
}

async function readJsonIfExists<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

// Resolve an artifact's contract path (always "bridge/artifacts/...") to an
// absolute path under this machine's bridge root, refusing anything that would
// escape it (defense against a malicious imported bundle).
function resolveArtifact(relPath: string): string {
  const abs = path.resolve(ROOT, relPath);
  if (abs !== BRIDGE && !abs.startsWith(BRIDGE + path.sep)) {
    throw new Error(`artifact path escapes bridge/: ${relPath}`);
  }
  return abs;
}

// =====================================================================
// Bundle shapes — the single file that crosses the airgap on the device.
// =====================================================================
export type BundleArtifact = {
  path: string; // contract path, e.g. bridge/artifacts/m_8821/frida/n1.log
  sha256: string; // real sha256 of the bytes
  size_bytes: number;
  encoding: "utf8" | "base64";
  data: string;
};

type BundleManifestBase = {
  bundle_format: "darkbridge/1";
  transfer_id: string; // unique per content: <mission_id>.<producer>.<checksum8>
  mission_id: string;
  package_name?: string; // which app this transfer is for (ledger grouping)
  complete: boolean; // mission: traced+required present · evidence: dynamic_confirmed + artifacts
  created_at: string;
  producer: Role;
};

export type MissionBundle = {
  manifest: BundleManifestBase & { bundle_type: "mission" };
  mission: MissionContext;
};

export type EvidenceBundle = {
  manifest: BundleManifestBase & { bundle_type: "evidence" };
  evidence: EvidenceReturn;
  artifacts: BundleArtifact[];
  artifactContent: Record<string, ArtifactContent>;
};

export type AnyBundle = MissionBundle | EvidenceBundle;

// ---- Transfer identity + ledger ------------------------------------
// A transfer_id is derived from the message checksum, so it is UNIQUE per
// content and STABLE across re-sends (re-carrying the identical bundle is a
// no-op duplicate, not a silent overwrite). The ledger records every import so
// Yoda knows, per package, what arrived and whether it's complete.
function transferId(missionId: string, producer: Role, checksum: string): string {
  return `${missionId}.${producer}.${checksum.slice(0, 8)}`;
}

export type TransferLogEntry = {
  transfer_id: string;
  kind: "mission" | "evidence";
  mission_id: string;
  package_name?: string;
  producer: Role;
  created_at: string; // when the bundle was packed (from the manifest)
  imported_at: string; // when it landed on this machine
  complete: boolean;
  checksum_ok: boolean;
  artifacts_verified: number;
  duplicate: boolean; // transfer_id already in this machine's ledger
};

const LEDGER = path.join(BRIDGE, "transfers.json");

export async function getTransfers(): Promise<TransferLogEntry[]> {
  return (await readJsonIfExists<TransferLogEntry[]>(LEDGER)) ?? [];
}

async function appendTransfer(entry: TransferLogEntry): Promise<void> {
  const log = await getTransfers();
  log.push(entry);
  await atomicWrite(LEDGER, JSON.stringify(log, null, 2));
}

// =====================================================================
// PRODUCE (Yoda) — write the MissionContext into yoda_outbox.
// Mission is static-only, so it carries no binary artifacts.
// =====================================================================
export async function produceMission(mission: MissionContext): Promise<void> {
  const file = path.join(BRIDGE, "yoda_outbox", MISSION_FILE(mission.mission_id));
  await atomicWrite(file, JSON.stringify(mission, null, 2));
}

// =====================================================================
// PRODUCE (Vader) — materialize the dynamic evidence as REAL files.
// Reads the golden case (the dynamic run's output), writes every artifact
// to disk under bridge/artifacts/<id>/, persists the renderable content,
// and writes the EvidenceReturn into vader_outbox.
// =====================================================================
export async function produceEvidence(
  evidence: EvidenceReturn,
  artifactContent: Record<string, ArtifactContent>,
  extras: { payloadStoragePath: string }[],
): Promise<{ artifactCount: number }> {
  const id = evidence.mission_id;
  let count = 0;

  // 1. per-node artifacts (frida logs, http captures, screenshots)
  for (const [contractPath, content] of Object.entries(artifactContent)) {
    const bytes = await artifactBytes(content);
    await atomicWrite(resolveArtifact(contractPath), bytes);
    count++;
  }

  // 2. extracted payloads (dropper) — copy the real binary off public/ into
  //    the bridge artifact store, mirroring "pulled off the device".
  for (const ex of extras) {
    const src = path.join(ROOT, "public", ex.payloadStoragePath);
    const dest = resolveArtifact(
      `bridge/artifacts/${id}/payloads/${path.basename(ex.payloadStoragePath)}`,
    );
    try {
      const buf = await fs.readFile(src);
      await atomicWrite(dest, buf);
      count++;
    } catch {
      // golden payload may be absent in some checkouts — non-fatal
    }
  }

  // 3. persist renderable content so the importing machine can render
  //    everything from its own disk (no shared client import).
  await atomicWrite(
    resolveArtifact(`bridge/artifacts/${id}/_content.json`),
    JSON.stringify(artifactContent, null, 2),
  );

  // 4. the contract message itself
  const file = path.join(BRIDGE, "vader_outbox", EVIDENCE_FILE(id));
  await atomicWrite(file, JSON.stringify(evidence, null, 2));

  return { artifactCount: count };
}

async function artifactBytes(content: ArtifactContent): Promise<Buffer> {
  if (content.kind === "frida") {
    return Buffer.from(content.lines.join("\n"), "utf8");
  }
  if (content.kind === "http") {
    return Buffer.from(JSON.stringify(content, null, 2), "utf8");
  }
  // screenshot — pull the real image bytes from public/
  const src = path.join(ROOT, "public", content.src.replace(/^\//, ""));
  try {
    return await fs.readFile(src);
  } catch {
    return Buffer.from(`<!-- missing screenshot: ${content.src} -->`, "utf8");
  }
}

// =====================================================================
// PACK — assemble the single device file from this machine's outbox.
// =====================================================================
export async function packMissionBundle(missionId: string): Promise<MissionBundle | null> {
  const mission = await readJsonIfExists<MissionContext>(
    path.join(BRIDGE, "yoda_outbox", MISSION_FILE(missionId)),
  );
  if (!mission) return null;
  return {
    manifest: {
      bundle_format: "darkbridge/1",
      bundle_type: "mission",
      transfer_id: transferId(missionId, "yoda", mission.checksum),
      mission_id: missionId,
      package_name: mission.case_identity.package_name,
      complete: mission.flow.nodes.length > 0 && mission.flow.required_nodes.length > 0,
      created_at: new Date().toISOString(),
      producer: "yoda",
    },
    mission,
  };
}

export async function packEvidenceBundle(missionId: string): Promise<EvidenceBundle | null> {
  const evidence = await readJsonIfExists<EvidenceReturn>(
    path.join(BRIDGE, "vader_outbox", EVIDENCE_FILE(missionId)),
  );
  if (!evidence) return null;

  // Best-effort package_name (for ledger grouping) from the mission on this machine.
  const linkedMission =
    (await readJsonIfExists<MissionContext>(path.join(BRIDGE, "vader_inbox", MISSION_FILE(missionId)))) ??
    (await readJsonIfExists<MissionContext>(path.join(BRIDGE, "yoda_outbox", MISSION_FILE(missionId))));

  const artifactContent =
    (await readJsonIfExists<Record<string, ArtifactContent>>(
      resolveArtifact(`bridge/artifacts/${missionId}/_content.json`),
    )) ?? {};

  // Collect every real file under bridge/artifacts/<id>/ (except _content.json).
  const artifacts: BundleArtifact[] = [];
  const base = resolveArtifact(`bridge/artifacts/${missionId}`);
  for (const abs of await walk(base)) {
    if (path.basename(abs) === "_content.json") continue;
    const buf = await fs.readFile(abs);
    const rel = path.relative(ROOT, abs).split(path.sep).join("/");
    const isText = /\.(log|har|json|txt|svg)$/i.test(abs);
    artifacts.push({
      path: rel,
      sha256: realSha256(buf),
      size_bytes: buf.length,
      encoding: isText ? "utf8" : "base64",
      data: isText ? buf.toString("utf8") : buf.toString("base64"),
    });
  }

  return {
    manifest: {
      bundle_format: "darkbridge/1",
      bundle_type: "evidence",
      transfer_id: transferId(missionId, "vader", evidence.checksum),
      mission_id: missionId,
      package_name: linkedMission?.case_identity.package_name,
      complete: evidence.dynamic_confirmed && artifacts.length > 0,
      created_at: new Date().toISOString(),
      producer: "vader",
    },
    evidence,
    artifacts,
    artifactContent,
  };
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(abs)));
    else out.push(abs);
  }
  return out;
}

// =====================================================================
// IMPORT — unpack a carried bundle into THIS machine's inbox, verifying
// every checksum. This is the only path data reaches a machine.
// =====================================================================
export type ImportResult = {
  ok: boolean;
  kind: "mission" | "evidence";
  transfer_id: string;
  mission_id: string;
  package_name?: string;
  complete: boolean;
  duplicate: boolean; // this exact transfer was already imported here
  checksum_ok: boolean;
  artifacts_written: number;
  artifacts_verified: number;
  errors: string[];
};

// Derive a stable transfer_id even for a manifest that predates the field.
function manifestTransferId(m: BundleManifestBase, checksum: string): string {
  return m.transfer_id ?? transferId(m.mission_id, m.producer, checksum);
}

export async function importBundle(bundle: AnyBundle): Promise<ImportResult> {
  const errors: string[] = [];
  if (bundle?.manifest?.bundle_format !== "darkbridge/1") {
    throw new Error("unrecognized bundle format");
  }

  if (bundle.manifest.bundle_type === "mission") {
    const { mission, manifest } = bundle as MissionBundle;
    const checksum_ok = verifyChecksum(mission);
    if (!checksum_ok) errors.push("MissionContext checksum mismatch");
    const tid = manifestTransferId(manifest, mission.checksum);
    const duplicate = (await getTransfers()).some((t) => t.transfer_id === tid);
    await atomicWrite(
      path.join(BRIDGE, "vader_inbox", MISSION_FILE(mission.mission_id)),
      JSON.stringify(mission, null, 2),
    );
    await appendTransfer({
      transfer_id: tid, kind: "mission", mission_id: mission.mission_id,
      package_name: manifest.package_name ?? mission.case_identity.package_name,
      producer: manifest.producer, created_at: manifest.created_at,
      imported_at: new Date().toISOString(), complete: manifest.complete,
      checksum_ok, artifacts_verified: 0, duplicate,
    });
    return {
      ok: checksum_ok,
      kind: "mission",
      transfer_id: tid,
      mission_id: mission.mission_id,
      package_name: manifest.package_name ?? mission.case_identity.package_name,
      complete: manifest.complete,
      duplicate,
      checksum_ok,
      artifacts_written: 0,
      artifacts_verified: 0,
      errors,
    };
  }

  // evidence bundle
  const { evidence, artifacts, artifactContent, manifest } = bundle as EvidenceBundle;
  const checksum_ok = verifyChecksum(evidence);
  if (!checksum_ok) errors.push("EvidenceReturn checksum mismatch");
  const tid = manifestTransferId(manifest, evidence.checksum);
  const duplicate = (await getTransfers()).some((t) => t.transfer_id === tid);

  let written = 0;
  let verified = 0;
  for (const a of artifacts) {
    const buf =
      a.encoding === "base64"
        ? Buffer.from(a.data, "base64")
        : Buffer.from(a.data, "utf8");
    if (realSha256(buf) === a.sha256) verified++;
    else errors.push(`artifact sha256 mismatch: ${a.path}`);
    await atomicWrite(resolveArtifact(a.path), buf);
    written++;
  }

  await atomicWrite(
    resolveArtifact(`bridge/artifacts/${evidence.mission_id}/_content.json`),
    JSON.stringify(artifactContent, null, 2),
  );
  await atomicWrite(
    path.join(BRIDGE, "yoda_inbox", EVIDENCE_FILE(evidence.mission_id)),
    JSON.stringify(evidence, null, 2),
  );

  await appendTransfer({
    transfer_id: tid, kind: "evidence", mission_id: evidence.mission_id,
    package_name: manifest.package_name, producer: manifest.producer,
    created_at: manifest.created_at, imported_at: new Date().toISOString(),
    complete: manifest.complete, checksum_ok, artifacts_verified: verified, duplicate,
  });

  return {
    ok: checksum_ok && verified === artifacts.length,
    kind: "evidence",
    transfer_id: tid,
    mission_id: evidence.mission_id,
    package_name: manifest.package_name,
    complete: manifest.complete,
    duplicate,
    checksum_ok,
    artifacts_written: written,
    artifacts_verified: verified,
    errors,
  };
}

// =====================================================================
// READ MODEL — what each machine's dashboard renders, straight off its disk.
// =====================================================================
export type BridgeState = {
  role: Role;
  // Yoda: outbox mission (produced) + inbox evidence (carried back).
  // Vader: inbox mission (carried in) + outbox evidence (produced).
  mission: MissionContext | null;
  missionInOutbox: boolean;
  evidence: EvidenceReturn | null;
  evidenceInOutbox: boolean;
  artifactContent: Record<string, ArtifactContent>;
};

export async function getState(role: Role, missionId: string): Promise<BridgeState> {
  if (role === "yoda") {
    const mission = await readJsonIfExists<MissionContext>(
      path.join(BRIDGE, "yoda_outbox", MISSION_FILE(missionId)),
    );
    const evidence = await readJsonIfExists<EvidenceReturn>(
      path.join(BRIDGE, "yoda_inbox", EVIDENCE_FILE(missionId)),
    );
    const artifactContent = evidence
      ? (await readJsonIfExists<Record<string, ArtifactContent>>(
          resolveArtifact(`bridge/artifacts/${missionId}/_content.json`),
        )) ?? {}
      : {};
    return {
      role,
      mission,
      missionInOutbox: !!mission,
      evidence,
      evidenceInOutbox: false,
      artifactContent,
    };
  }

  // vader
  const mission = await readJsonIfExists<MissionContext>(
    path.join(BRIDGE, "vader_inbox", MISSION_FILE(missionId)),
  );
  const evidence = await readJsonIfExists<EvidenceReturn>(
    path.join(BRIDGE, "vader_outbox", EVIDENCE_FILE(missionId)),
  );
  const artifactContent =
    (await readJsonIfExists<Record<string, ArtifactContent>>(
      resolveArtifact(`bridge/artifacts/${missionId}/_content.json`),
    )) ?? {};
  return {
    role,
    mission,
    missionInOutbox: false,
    evidence,
    evidenceInOutbox: !!evidence,
    artifactContent,
  };
}

// Serve a single real artifact file off this machine's disk.
export async function readArtifact(
  contractPath: string,
): Promise<{ buf: Buffer; contentType: string } | null> {
  try {
    const abs = resolveArtifact(contractPath);
    const buf = await fs.readFile(abs);
    return { buf, contentType: contentTypeFor(abs, buf) };
  } catch {
    return null;
  }
}

function contentTypeFor(file: string, buf?: Buffer): string {
  // Content sniff first: the golden screenshots ship as SVG even though the
  // contract path ends in .png, so trust the bytes over the extension.
  if (buf) {
    const head = buf.subarray(0, 64).toString("utf8").trimStart();
    if (head.startsWith("<svg") || head.startsWith("<?xml")) return "image/svg+xml";
  }
  if (/\.svg$/i.test(file)) return "image/svg+xml";
  if (/\.png$/i.test(file)) return "image/png";
  if (/\.har$|\.json$/i.test(file)) return "application/json";
  if (/\.log$|\.txt$/i.test(file)) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

// Reset this machine's bridge (operator convenience / demo reset).
export async function resetBridge(): Promise<void> {
  await fs.rm(BRIDGE, { recursive: true, force: true });
}
