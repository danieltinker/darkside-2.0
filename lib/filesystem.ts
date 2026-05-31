import type { FlowNode, CaseIdentity, NodeEvidence, ExtractedPayload } from "./contract";

// =====================================================================
// Filesystem derivation — projects the contract onto the on-disk layout a real
// two-machine build lays down, FOR A GIVEN MISSION. Nothing is invented: the
// trees are derived from the selected mission's flow + evidence + bridge state,
// so the explorer works for ANY package/version, not a single hardcoded one.
//
//   YODA (static / mission control)  →  decompiled APK sources = static evidence
//   PIXELBRIDGE (shared transport)   →  the four mailboxes + artifacts store
//   DARTH VADER (dynamic lab)        →  device runtime = dynamic evidence source
// =====================================================================

export type FsKind =
  | "dir" | "apk" | "source" | "native" | "json"
  | "frida" | "http" | "screenshot" | "payload" | "proc";

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
  present: boolean;
  meta?: string;
  nodeIds?: string[];
  detail?: FsDetail;
  children?: FsNode[];
};

export type MachineSide = "yoda" | "bridge" | "vader";
export type Filesystems = Record<MachineSide, FsNode>;

export type BridgePhase = {
  missionInYodaOutbox: boolean;
  missionInVaderInbox: boolean;
  evidenceInVaderOutbox: boolean;
  evidenceInYodaInbox: boolean;
};

// Everything the trees need for ONE mission — sourced from the selected mission's
// on-disk state (mission.flow + evidence), so it scales across packages/versions.
export type FsInput = {
  phase: BridgePhase;
  missionId: string;
  identity: CaseIdentity;
  flowNodes: FlowNode[];
  nodeEvidence: NodeEvidence[];
  payloads: ExtractedPayload[];
};

const dir = (name: string, path: string, children: FsNode[], meta?: string): FsNode => ({
  name, path, kind: "dir", present: true, meta, children,
});

function basename(p: string): string {
  return p.split("/").filter(Boolean).pop() ?? p;
}

// ---- Yoda: decompiled sources from this mission's node signatures ----
function buildSourcesTree(base: string, flowNodes: FlowNode[]): FsNode {
  const byFile = new Map<string, FlowNode[]>();
  for (const n of flowNodes) {
    const fp = n.signature?.file_path;
    if (!fp) continue; // role-level nodes carry no per-app source file
    const list = byFile.get(fp) ?? [];
    list.push(n);
    byFile.set(fp, list);
  }
  const root = dir("sources", `${base}/sources`, [], "decompiled");
  for (const [filePath, nodes] of byFile) {
    const segments = filePath.split("/").slice(1);
    let cursor = root;
    let acc = root.path;
    segments.forEach((seg, i) => {
      acc = `${acc}/${seg}`;
      if (i === segments.length - 1) {
        cursor.children!.push({
          name: seg,
          path: acc,
          kind: "source",
          present: true,
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

function buildYoda(missionId: string, id: CaseIdentity, flowNodes: FlowNode[]): FsNode {
  const ws = `yoda/workspace/${missionId}`;
  return dir("yoda", "yoda", [
    dir(
      "workspace",
      "yoda/workspace",
      [
        dir(missionId, ws, [
          {
            name: `${id.package_name}-${id.version_code}.apk`,
            path: `${ws}/${id.package_name}-${id.version_code}.apk`,
            kind: "apk",
            present: true,
            meta: `v${id.version_name}`,
            detail: { type: "apk" },
          },
          buildSourcesTree(ws, flowNodes),
        ]),
      ],
      "static analysis",
    ),
  ]);
}

// ---- PixelBridge: the four mailboxes + the artifacts store -------------
function buildBridge(
  p: BridgePhase,
  missionId: string,
  nodeEvidence: NodeEvidence[],
  payloads: ExtractedPayload[],
): FsNode {
  const artifactsPresent = p.evidenceInVaderOutbox || p.evidenceInYodaInbox;
  const art = `bridge/artifacts/${missionId}`;

  const frida: FsNode[] = [];
  const http: FsNode[] = [];
  const shots: FsNode[] = [];
  for (const ne of nodeEvidence) {
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

  const payloadLeaves: FsNode[] = payloads.map((pl) => ({
    name: basename(pl.storage_path),
    path: `${art}/payloads/${basename(pl.storage_path)}`,
    kind: "payload",
    present: artifactsPresent,
    meta: pl.type,
    nodeIds: pl.found_at_node ? [pl.found_at_node] : undefined,
    detail: { type: "payload", payloadId: pl.payload_id },
  }));

  const missionLeaf = (path: string, present: boolean): FsNode => ({
    name: `${missionId}.MissionContext.json`,
    path, kind: "json", present, meta: present ? "stored" : "empty",
    detail: { type: "message", which: "mission" },
  });
  const evidenceLeaf = (path: string, present: boolean): FsNode => ({
    name: `${missionId}.EvidenceReturn.json`,
    path, kind: "json", present, meta: present ? "stored" : "empty",
    detail: { type: "message", which: "evidence" },
  });

  return dir("bridge", "bridge", [
    dir("yoda_outbox", "bridge/yoda_outbox", [missionLeaf(`bridge/yoda_outbox/${missionId}.MissionContext.json`, p.missionInYodaOutbox)], "A→B"),
    dir("vader_inbox", "bridge/vader_inbox", [missionLeaf(`bridge/vader_inbox/${missionId}.MissionContext.json`, p.missionInVaderInbox)], "carried in"),
    dir("vader_outbox", "bridge/vader_outbox", [evidenceLeaf(`bridge/vader_outbox/${missionId}.EvidenceReturn.json`, p.evidenceInVaderOutbox)], "B→A"),
    dir("yoda_inbox", "bridge/yoda_inbox", [evidenceLeaf(`bridge/yoda_inbox/${missionId}.EvidenceReturn.json`, p.evidenceInYodaInbox)], "carried back"),
    dir(
      "artifacts",
      "bridge/artifacts",
      [
        dir(missionId, art, [
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
function buildVader(
  p: BridgePhase,
  id: CaseIdentity,
  payloads: ExtractedPayload[],
): FsNode {
  const ran = p.evidenceInVaderOutbox;
  const dropper = payloads[0];
  const pid = "14233";

  // device app-private files only exist once a dropper was pulled at runtime
  const filesDir: FsNode[] = dropper
    ? [
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
      ]
    : [];

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
              dir("files", `vader/device/data/data/${id.package_name}/files`, filesDir),
            ]),
          ]),
        ]),
        dir("proc", "vader/device/proc", [
          dir(pid, `vader/device/proc/${pid}`, [
            { name: "maps", path: `vader/device/proc/${pid}/maps`, kind: "proc", present: ran, meta: "frida", detail: { type: "proc" } },
          ]),
        ]),
      ],
      ran ? "live · pid " + pid : "not running",
    ),
  ]);
}

export function buildFilesystems(input: FsInput): Filesystems {
  return {
    yoda: buildYoda(input.missionId, input.identity, input.flowNodes),
    bridge: buildBridge(input.phase, input.missionId, input.nodeEvidence, input.payloads),
    vader: buildVader(input.phase, input.identity, input.payloads),
  };
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
