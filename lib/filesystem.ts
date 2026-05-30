import type { FlowNode } from "./contract";
import { mmpCloakingGraph } from "./flow";
import {
  missionContext,
  evidenceReturn,
  extractedPayloads,
  MISSION_ID,
} from "./mock";

// =====================================================================
// Filesystem derivation — projects the contract onto the on-disk layout a
// real two-machine build would lay down. Nothing new is invented here: the
// trees are derived from the same flow/evidence/bridge data the rest of the
// app uses.
//
//   YODA (static / mission control)  →  decompiled APK sources = static evidence
//   PIXELBRIDGE (shared transport)   →  the four mailboxes + artifacts store
//   DARTH VADER (dynamic lab)        →  device runtime = dynamic evidence source
//
// `present` is gated on the live session lifecycle so files appear on the
// bridge exactly as the mission/evidence flow runs.
// =====================================================================

export type FsKind =
  | "dir"
  | "apk"
  | "source"
  | "native"
  | "json"
  | "frida"
  | "http"
  | "screenshot"
  | "payload"
  | "proc";

export type FsDetail =
  | { type: "source"; filePath: string }
  | { type: "artifact"; artifactPath: string }
  | { type: "message"; which: "mission" | "evidence" }
  | { type: "native"; runtime: boolean }
  | { type: "payload"; payloadId: string }
  | { type: "apk" }
  | { type: "proc" };

export type FsNode = {
  name: string;
  path: string; // unique key + selection id
  kind: FsKind;
  present: boolean; // exists yet, given session state (dirs are always structural)
  meta?: string; // small right-aligned annotation
  nodeIds?: string[]; // graph nodes this file backs
  detail?: FsDetail; // what the detail pane renders
  children?: FsNode[];
};

export type MachineSide = "yoda" | "bridge" | "vader";

export type Filesystems = Record<MachineSide, FsNode>;

// Real per-mailbox disk presence, derived from each machine's bridge state.
// In an airgap these are four independent truths — a file can sit in Yoda's
// outbox long before anyone carries it into Vader's inbox.
export type BridgePhase = {
  missionInYodaOutbox: boolean;
  missionInVaderInbox: boolean;
  evidenceInVaderOutbox: boolean;
  evidenceInYodaInbox: boolean;
};

const dir = (name: string, path: string, children: FsNode[], meta?: string): FsNode => ({
  name,
  path,
  kind: "dir",
  present: true,
  meta,
  children,
});

function basename(p: string): string {
  return p.split("/").filter(Boolean).pop() ?? p;
}

// ---- Yoda: build the decompiled sources subtree from node signatures ----
function buildSourcesTree(base: string): FsNode {
  // Group nodes by file_path — one file can back several nodes.
  const byFile = new Map<string, FlowNode[]>();
  for (const n of mmpCloakingGraph.nodes) {
    const fp = n.signature?.file_path;
    if (!fp) continue; // role-level nodes carry no per-app source file
    const list = byFile.get(fp) ?? [];
    list.push(n);
    byFile.set(fp, list);
  }

  const root = dir("sources", `${base}/sources`, [], "decompiled");

  for (const [filePath, nodes] of byFile) {
    // strip the leading "sources/" segment — root already represents it
    const segments = filePath.split("/").slice(1);
    let cursor = root;
    let acc = root.path;
    segments.forEach((seg, i) => {
      acc = `${acc}/${seg}`;
      const isLeaf = i === segments.length - 1;
      if (isLeaf) {
        cursor.children!.push({
          name: seg,
          path: acc,
          kind: "source",
          present: true, // static analysis is done before the flow runs
          meta: nodes.map((n) => `:${n.signature?.line ?? "?"}`).join(" "),
          nodeIds: nodes.map((n) => n.node_id),
          detail: { type: "source", filePath },
        });
      } else {
        let next = cursor.children!.find((c) => c.name === seg && c.kind === "dir");
        if (!next) {
          next = dir(seg, acc, []);
          cursor.children!.push(next);
        }
        cursor = next;
      }
    });
  }
  return root;
}

function buildYoda(): FsNode {
  const ws = `yoda/workspace/${MISSION_ID}`;
  const id = missionContext.case_identity;
  return dir("yoda", "yoda", [
    dir(
      "workspace",
      "yoda/workspace",
      [
        dir(MISSION_ID, ws, [
          {
            name: `${id.package_name}-${id.version_code}.apk`,
            path: `${ws}/${id.package_name}-${id.version_code}.apk`,
            kind: "apk",
            present: true,
            meta: `v${id.version_name}`,
            detail: { type: "apk" },
          },
          buildSourcesTree(ws),
        ]),
      ],
      "static analysis",
    ),
  ]);
}

// ---- PixelBridge: the four mailboxes + the artifacts store -------------
function buildBridge(p: BridgePhase): FsNode {
  // Artifacts are materialized by Vader and physically exist wherever the
  // evidence message has landed (Vader's outbox and/or Yoda's inbox).
  const artifactsPresent = p.evidenceInVaderOutbox || p.evidenceInYodaInbox;
  const art = `bridge/artifacts/${MISSION_ID}`;

  // Group Vader's artifacts by kind from the EvidenceReturn.
  const frida: FsNode[] = [];
  const http: FsNode[] = [];
  const shots: FsNode[] = [];
  for (const ne of evidenceReturn.node_evidence) {
    for (const a of ne.artifacts) {
      const leaf: FsNode = {
        name: basename(a.path),
        path: a.path,
        kind: a.kind,
        present: artifactsPresent,
        meta: a.label,
        nodeIds: [ne.node_id],
        detail: { type: "artifact", artifactPath: a.path },
      };
      if (a.kind === "frida") frida.push(leaf);
      else if (a.kind === "http") http.push(leaf);
      else shots.push(leaf);
    }
  }

  const payloadLeaves: FsNode[] = extractedPayloads.map((pl) => ({
    name: basename(pl.storage_path),
    path: `${art}/payloads/${basename(pl.storage_path)}`,
    kind: "payload",
    present: artifactsPresent,
    meta: pl.type,
    nodeIds: pl.found_at_node ? [pl.found_at_node] : undefined,
    detail: { type: "payload", payloadId: pl.payload_id },
  }));

  const missionLeaf = (path: string, present: boolean): FsNode => ({
    name: `${MISSION_ID}.MissionContext.json`,
    path,
    kind: "json",
    present,
    meta: present ? "stored" : "empty",
    detail: { type: "message", which: "mission" },
  });
  const evidenceLeaf = (path: string, present: boolean): FsNode => ({
    name: `${MISSION_ID}.EvidenceReturn.json`,
    path,
    kind: "json",
    present,
    meta: present ? "stored" : "empty",
    detail: { type: "message", which: "evidence" },
  });

  return dir("bridge", "bridge", [
    dir(
      "yoda_outbox",
      "bridge/yoda_outbox",
      [missionLeaf("bridge/yoda_outbox/m.MissionContext.json", p.missionInYodaOutbox)],
      "A→B",
    ),
    dir(
      "vader_inbox",
      "bridge/vader_inbox",
      [missionLeaf("bridge/vader_inbox/m.MissionContext.json", p.missionInVaderInbox)],
      "carried in",
    ),
    dir(
      "vader_outbox",
      "bridge/vader_outbox",
      [evidenceLeaf("bridge/vader_outbox/m.EvidenceReturn.json", p.evidenceInVaderOutbox)],
      "B→A",
    ),
    dir(
      "yoda_inbox",
      "bridge/yoda_inbox",
      [evidenceLeaf("bridge/yoda_inbox/m.EvidenceReturn.json", p.evidenceInYodaInbox)],
      "carried back",
    ),
    dir(
      "artifacts",
      "bridge/artifacts",
      [
        dir(MISSION_ID, art, [
          dir("frida", `${art}/frida`, frida, `${frida.length}`),
          dir("http", `${art}/http`, http, `${http.length}`),
          dir("screenshots", `${art}/screenshots`, shots, `${shots.length}`),
          dir("payloads", `${art}/payloads`, payloadLeaves, `${payloadLeaves.length}`),
        ]),
      ],
      artifactsPresent ? "← vader capture" : "awaiting run",
    ),
  ]);
}

// ---- Darth Vader: the on-device runtime (dynamic evidence source) ------
function buildVader(p: BridgePhase): FsNode {
  // The device shows runtime artifacts once Vader has run (evidence produced).
  const ran = p.evidenceInVaderOutbox;
  const id = missionContext.case_identity;
  const dropper = extractedPayloads[0];
  const pid = "14233";

  return dir("vader", "vader", [
    dir(
      "device",
      "vader/device",
      [
        dir("data", "vader/device/data", [
          dir("app", "vader/device/data/app", [
            dir(`${id.package_name}-1`, `vader/device/data/app/${id.package_name}-1`, [
              {
                name: "base.apk",
                path: `vader/device/data/app/${id.package_name}-1/base.apk`,
                kind: "apk",
                present: ran,
                meta: "installed",
                detail: { type: "apk" },
              },
            ]),
          ]),
          dir("data", "vader/device/data/data", [
            dir(id.package_name, `vader/device/data/data/${id.package_name}`, [
              dir("files", `vader/device/data/data/${id.package_name}/files`, [
                dir(".cl", `vader/device/data/data/${id.package_name}/files/.cl`, [
                  {
                    name: basename(dropper.source_path_on_device),
                    path: dropper.source_path_on_device,
                    kind: "payload",
                    present: ran,
                    meta: "dropper",
                    nodeIds: dropper.found_at_node ? [dropper.found_at_node] : undefined,
                    detail: { type: "payload", payloadId: dropper.payload_id },
                  },
                ]),
              ]),
            ]),
          ]),
        ]),
        dir("proc", "vader/device/proc", [
          dir(pid, `vader/device/proc/${pid}`, [
            {
              name: "maps",
              path: `vader/device/proc/${pid}/maps`,
              kind: "proc",
              present: ran,
              meta: "frida",
              detail: { type: "proc" },
            },
          ]),
        ]),
      ],
      ran ? "live · pid " + pid : "not running",
    ),
  ]);
}

export function buildFilesystems(p: BridgePhase): Filesystems {
  return { yoda: buildYoda(), bridge: buildBridge(p), vader: buildVader(p) };
}

// Walk a tree to resolve a selection path → node.
export function findNode(root: FsNode, path: string): FsNode | undefined {
  if (root.path === path) return root;
  for (const c of root.children ?? []) {
    const hit = findNode(c, path);
    if (hit) return hit;
  }
  return undefined;
}
