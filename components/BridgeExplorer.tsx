"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildFilesystems,
  findNode,
  type BridgePhase,
  type FsNode,
  type MachineSide,
} from "@/lib/filesystem";
import type { BridgeStateDTO } from "@/lib/session";
import type { ArtifactContent } from "@/lib/mock";
import type { MissionContext, EvidenceReturn, FlowNode, NodeEvidence, ExtractedPayload } from "@/lib/contract";
import { verifyChecksum } from "@/lib/bridge";
import { FileTree } from "./FileTree";
import { EvidenceViewer } from "./EvidenceViewer";
import { PayloadCard } from "./PayloadCard";
import { StatusChip } from "./StatusChip";

const PANELS: { side: MachineSide; title: string; role: string; accent: string; ring: string }[] = [
  { side: "yoda", title: "Yoda", role: "static · mission control", accent: "text-yoda", ring: "border-yoda/30" },
  { side: "bridge", title: "PixelBridge", role: "shared transport", accent: "text-accent-cyan", ring: "border-accent-cyan/30" },
  { side: "vader", title: "Darth Vader", role: "dynamic · lab", accent: "text-vader", ring: "border-vader/30" },
];

// A mission's data for the explorer (sourced from the selected mission's disk state).
type MissionView = {
  mission: MissionContext | null;
  evidence: EvidenceReturn | null;
  content: Record<string, ArtifactContent>;
};

// ---- detail-pane renderers (all take the SELECTED mission's data) ------
function SourceDetail({ filePath, flowNodes }: { filePath: string; flowNodes: FlowNode[] }) {
  const nodes = flowNodes.filter((n) => n.signature?.file_path === filePath);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <StatusChip tone="green" label="Static evidence" />
        <span className="font-mono text-[11px] text-ink-muted">{filePath}</span>
      </div>
      {nodes.map((n) => {
        const sig = n.signature!;
        return (
          <div key={n.node_id} className="rounded-md border border-edge-faint bg-bg-void/50 p-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10.5px] text-ink-faint">{n.node_id}</span>
              <span className="font-mono text-[12px] text-ink-primary">
                <span className="text-ink-secondary">{sig.class_name}</span>.{sig.method}
              </span>
              <span className="font-mono text-[10.5px] text-ink-faint">:{sig.line}</span>
              {n.decryptor && <StatusChip tone="amber" label={`decryptor · ${n.decryptor.algorithm}`} />}
              {n.produces_url && <StatusChip tone="red" label="produces url" />}
            </div>
            <pre className="overflow-x-auto rounded border border-edge-faint bg-bg-void/80 p-2.5 font-mono text-[11px] leading-relaxed text-ink-secondary">
              {sig.snippet}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

function ArtifactDetail({ artifactPath, nodeEvidence, content }: { artifactPath: string; nodeEvidence: NodeEvidence[]; content: Record<string, ArtifactContent> }) {
  for (const ne of nodeEvidence) {
    const a = ne.artifacts.find((x) => x.path === artifactPath);
    if (a) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusChip tone="red" label="Dynamic evidence" />
            <span className="font-mono text-[11px] text-ink-muted">{ne.node_id}</span>
          </div>
          <EvidenceViewer artifact={a} content={content[a.path]} />
          <p className="border-l border-edge pl-2 text-[12px] text-ink-secondary">{ne.observation}</p>
        </div>
      );
    }
  }
  return <Empty text="artifact not present yet — run the dynamic side" />;
}

function MessageDetail({ which, mission, evidence }: { which: "mission" | "evidence"; mission: MissionContext | null; evidence: EvidenceReturn | null }) {
  const obj = which === "mission" ? mission : evidence;
  if (!obj) return <Empty text={`${which} not present on the bridge yet`} />;
  const ok = verifyChecksum(obj);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={which === "mission" ? "green" : "red"} label={obj.type} />
        <span className="font-mono text-[11px] text-ink-muted">{obj.sent_by} → {obj.sent_to}</span>
        <StatusChip tone={ok ? "green" : "red"} dot label={ok ? "checksum verified" : "checksum mismatch"} title={obj.checksum} />
      </div>
      <pre className="max-h-[440px] overflow-auto rounded-md border border-edge-faint bg-bg-void/80 p-3 font-mono text-[11px] leading-relaxed text-ink-secondary">
        {JSON.stringify(obj, null, 2)}
      </pre>
    </div>
  );
}

function PayloadDetail({ payloadId, payloads }: { payloadId: string; payloads: ExtractedPayload[] }) {
  const p = payloads.find((x) => x.payload_id === payloadId);
  if (!p) return <Empty text="payload not found" />;
  return (
    <div className="space-y-2">
      <StatusChip tone="red" dot label="Extracted payload" />
      <PayloadCard payload={p} />
    </div>
  );
}

function ApkDetail({ mission }: { mission: MissionContext | null }) {
  if (!mission) return <Empty text="no mission loaded" />;
  const id = mission.case_identity;
  return (
    <div className="space-y-2">
      <StatusChip tone="amber" label="APK package" />
      <dl className="space-y-1 rounded-md border border-edge-faint bg-bg-void/50 p-3 font-mono text-[11px] text-ink-muted">
        <Row k="package" v={id.package_name} />
        <Row k="version" v={`${id.version_name} (${id.version_code})`} />
        <Row k="developer" v={id.developer} />
        <Row k="countries" v={id.top_countries.join(" · ")} />
      </dl>
    </div>
  );
}

function ProcDetail() {
  return (
    <div className="space-y-2">
      <StatusChip tone="cyan" label="Process map" />
      <p className="text-[12px] text-ink-secondary">
        Frida attaches to the running process and reads <span className="font-mono">/proc/&lt;pid&gt;/maps</span>{" "}
        to locate loaded native libraries before hooking their JNI exports.
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-ink-faint">{k}</dt>
      <dd className="break-all text-ink-secondary">{v}</dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[160px] items-center justify-center rounded-lg border border-dashed border-edge bg-bg-void/30 text-center">
      <p className="max-w-xs px-4 font-mono text-[12px] text-ink-muted">{text}</p>
    </div>
  );
}

function DetailPane({ node, view }: { node: FsNode | undefined; view: MissionView }) {
  if (!node || !node.detail || (!node.children && !node.present)) {
    return <Empty text="select a file on any machine to extract its static or dynamic evidence" />;
  }
  const d = node.detail;
  const flowNodes = view.mission?.flow.nodes ?? [];
  const nodeEvidence = view.evidence?.node_evidence ?? [];
  const payloads = view.evidence?.extracted_payloads ?? [];
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 border-b border-edge-faint pb-2">
        <span className="font-mono text-[11px] text-ink-faint">path</span>
        <span className="break-all font-mono text-[12px] text-ink-primary">{node.path}</span>
      </div>
      {d.type === "source" && <SourceDetail filePath={d.filePath} flowNodes={flowNodes} />}
      {d.type === "artifact" && <ArtifactDetail artifactPath={d.artifactPath} nodeEvidence={nodeEvidence} content={view.content} />}
      {d.type === "message" && <MessageDetail which={d.which} mission={view.mission} evidence={view.evidence} />}
      {d.type === "payload" && <PayloadDetail payloadId={d.payloadId} payloads={payloads} />}
      {d.type === "apk" && <ApkDetail mission={view.mission} />}
      {d.type === "proc" && <ProcDetail />}
    </div>
  );
}

// ---- the explorer -----------------------------------------------------
const POLL_MS = 2500;
type MissionOpt = { id: string; label: string };

export function BridgeExplorer() {
  const [missions, setMissions] = useState<MissionOpt[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [view, setView] = useState<MissionView>({ mission: null, evidence: null, content: {} });
  const [phase, setPhase] = useState<BridgePhase>({
    missionInYodaOutbox: false, missionInVaderInbox: false, evidenceInVaderOutbox: false, evidenceInYodaInbox: false,
  });
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The mission list — distinct mission_ids from the transfer ledger (per package/version).
  const refreshMissions = useCallback(async () => {
    try {
      const res = await fetch("/api/bridge/transfers", { cache: "no-store" });
      if (!res.ok) return;
      const log = (await res.json()) as { mission_id: string; package_name?: string; version_name?: string }[];
      const seen = new Map<string, MissionOpt>();
      for (const t of log) {
        if (!seen.has(t.mission_id)) {
          const label = `${t.package_name ?? t.mission_id}${t.version_name ? ` v${t.version_name}` : ""}`;
          seen.set(t.mission_id, { id: t.mission_id, label });
        }
      }
      setMissions([...seen.values()]);
    } catch {
      /* keep prior */
    }
  }, []);

  // The selected mission's REAL state off disk (mission + evidence + artifacts + phase).
  const refreshState = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const [yRes, vRes] = await Promise.all([
        fetch(`/api/bridge/state?role=yoda&id=${id}`, { cache: "no-store" }),
        fetch(`/api/bridge/state?role=vader&id=${id}`, { cache: "no-store" }),
      ]);
      if (!yRes.ok || !vRes.ok) return;
      const y = (await yRes.json()) as BridgeStateDTO;
      const v = (await vRes.json()) as BridgeStateDTO;
      setPhase({
        missionInYodaOutbox: y.missionInOutbox,
        missionInVaderInbox: !!v.mission,
        evidenceInVaderOutbox: v.evidenceInOutbox,
        evidenceInYodaInbox: !!y.evidence,
      });
      setView({
        mission: y.mission ?? v.mission,
        evidence: y.evidence ?? v.evidence,
        content: Object.keys(y.artifactContent ?? {}).length ? y.artifactContent : v.artifactContent ?? {},
      });
    } catch {
      /* keep prior */
    }
  }, []);

  // Load the mission list; default the selection to the golden case if present.
  useEffect(() => {
    refreshMissions();
  }, [refreshMissions]);

  useEffect(() => {
    if (!missions.length) return;
    if (!selectedId || !missions.some((m) => m.id === selectedId)) {
      setSelectedId(missions.find((m) => m.id === "m_8821")?.id ?? missions[0].id);
    }
  }, [missions, selectedId]);

  // Fetch + poll the selected mission's state (fail-safe; skip hidden tab).
  useEffect(() => {
    if (!selectedId) return;
    refreshState(selectedId);
    const t = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      refreshMissions();
      refreshState(selectedId);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [selectedId, refreshState, refreshMissions]);

  const runDemo = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/bridge/demo", { method: "POST" });
      await refreshMissions();
      await refreshState(selectedId || "m_8821");
    } finally {
      setBusy(false);
    }
  }, [refreshMissions, refreshState, selectedId]);

  const reset = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/bridge/reset", { method: "POST" });
      setSelectedPath(null);
      setSelectedId("");
      setView({ mission: null, evidence: null, content: {} });
      await refreshMissions();
    } finally {
      setBusy(false);
    }
  }, [refreshMissions]);

  const fs = view.mission
    ? buildFilesystems({
        phase,
        missionId: selectedId,
        identity: view.mission.case_identity,
        flowNodes: view.mission.flow.nodes,
        nodeEvidence: view.evidence?.node_evidence ?? [],
        payloads: view.evidence?.extracted_payloads ?? [],
      })
    : null;

  const selectedNode =
    fs && selectedPath
      ? findNode(fs.yoda, selectedPath) ?? findNode(fs.bridge, selectedPath) ?? findNode(fs.vader, selectedPath)
      : undefined;

  return (
    <div className="space-y-4">
      {/* controls: mission selector + legend + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-bg-panel/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">mission</span>
          {missions.length ? (
            <select
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setSelectedPath(null); }}
              className="rounded-md border border-edge bg-bg-raised px-2 py-1 font-mono text-[12px] text-ink-secondary"
            >
              {missions.map((m) => (
                <option key={m.id} value={m.id}>{m.label} · {m.id}</option>
              ))}
            </select>
          ) : (
            <span className="font-mono text-[11px] text-ink-muted">none — run a transfer</span>
          )}
          <span className="font-mono text-[11px] text-ink-faint">{missions.length} mission{missions.length === 1 ? "" : "s"}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runDemo} disabled={busy} className="rounded-md border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-1.5 font-mono text-[12px] text-accent-cyan transition-colors hover:bg-accent-cyan/20 disabled:opacity-50">
            {busy ? "running…" : "▶ run full transfer (golden)"}
          </button>
          <button onClick={reset} disabled={busy} className="rounded-md border border-edge px-3 py-1.5 font-mono text-[12px] text-ink-muted transition-colors hover:text-ink-secondary disabled:opacity-50">
            ↺ reset
          </button>
        </div>
      </div>

      {/* three machine panels for the selected mission */}
      {fs ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {PANELS.map((p) => (
            <div key={p.side} className={`overflow-hidden rounded-xl border bg-bg-card/70 ${p.ring}`}>
              <div className="flex items-baseline justify-between border-b border-edge-faint px-3 py-2">
                <span className={`font-mono text-[12px] font-semibold ${p.accent}`}>{p.title}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{p.role}</span>
              </div>
              <div className="max-h-[420px] overflow-auto px-1.5 py-1.5">
                <FileTree root={fs[p.side]} selected={selectedPath} onSelect={setSelectedPath} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty text={missions.length ? "loading mission…" : "no missions on the bridge yet — run a transfer or import a bundle"} />
      )}

      {/* detail pane */}
      <div className="rounded-xl border border-edge bg-bg-card/70 p-4">
        <DetailPane node={selectedNode} view={view} />
      </div>
    </div>
  );
}
