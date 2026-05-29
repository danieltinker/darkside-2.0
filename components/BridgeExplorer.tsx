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
import {
  missionContext,
  evidenceReturn,
  artifactContent,
  extractedPayloads,
} from "@/lib/mock";
import { mmpCloakingGraph } from "@/lib/flow";
import { verifyChecksum } from "@/lib/bridge";
import { FileTree } from "./FileTree";
import { EvidenceViewer } from "./EvidenceViewer";
import { PayloadCard } from "./PayloadCard";
import { StatusChip } from "./StatusChip";

const PANELS: {
  side: MachineSide;
  title: string;
  role: string;
  accent: string; // text color
  ring: string; // border color
}[] = [
  { side: "yoda", title: "Yoda", role: "static · mission control", accent: "text-yoda", ring: "border-yoda/30" },
  { side: "bridge", title: "PixelBridge", role: "shared transport", accent: "text-accent-cyan", ring: "border-accent-cyan/30" },
  { side: "vader", title: "Darth Vader", role: "dynamic · lab", accent: "text-vader", ring: "border-vader/30" },
];

// ---- detail-pane renderers -------------------------------------------
function SourceDetail({ filePath }: { filePath: string }) {
  const nodes = mmpCloakingGraph.nodes.filter((n) => n.signature.file_path === filePath);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <StatusChip tone="green" label="Static evidence" />
        <span className="font-mono text-[11px] text-ink-muted">{filePath}</span>
      </div>
      {nodes.map((n) => (
        <div key={n.node_id} className="rounded-md border border-edge-faint bg-bg-void/50 p-3">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10.5px] text-ink-faint">{n.node_id}</span>
            <span className="font-mono text-[12px] text-ink-primary">
              <span className="text-ink-secondary">{n.signature.class_name}</span>.
              {n.signature.method}
            </span>
            <span className="font-mono text-[10.5px] text-ink-faint">:{n.signature.line}</span>
            {n.decryptor && <StatusChip tone="amber" label={`decryptor · ${n.decryptor.algorithm}`} />}
            {n.produces_url && <StatusChip tone="red" label="produces url" />}
          </div>
          <pre className="overflow-x-auto rounded border border-edge-faint bg-bg-void/80 p-2.5 font-mono text-[11px] leading-relaxed text-ink-secondary">
            {n.signature.snippet}
          </pre>
        </div>
      ))}
    </div>
  );
}

function ArtifactDetail({ artifactPath }: { artifactPath: string }) {
  for (const ne of evidenceReturn.node_evidence) {
    const a = ne.artifacts.find((x) => x.path === artifactPath);
    if (a) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusChip tone="red" label="Dynamic evidence" />
            <span className="font-mono text-[11px] text-ink-muted">{ne.node_id}</span>
          </div>
          <EvidenceViewer artifact={a} content={artifactContent[a.path]} />
          <p className="border-l border-edge pl-2 text-[12px] text-ink-secondary">{ne.observation}</p>
        </div>
      );
    }
  }
  return <Empty text="artifact not found" />;
}

function MessageDetail({ which }: { which: "mission" | "evidence" }) {
  const obj = which === "mission" ? missionContext : evidenceReturn;
  const ok = verifyChecksum(obj);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={which === "mission" ? "green" : "red"} label={obj.type} />
        <span className="font-mono text-[11px] text-ink-muted">
          {obj.sent_by} → {obj.sent_to}
        </span>
        <StatusChip
          tone={ok ? "green" : "red"}
          dot
          label={ok ? "checksum verified" : "checksum mismatch"}
          title={obj.checksum}
        />
      </div>
      <pre className="max-h-[440px] overflow-auto rounded-md border border-edge-faint bg-bg-void/80 p-3 font-mono text-[11px] leading-relaxed text-ink-secondary">
        {JSON.stringify(obj, null, 2)}
      </pre>
    </div>
  );
}

function NativeDetail({ runtime }: { runtime: boolean }) {
  const nf = runtime
    ? evidenceReturn.native_files[0]
    : mmpCloakingGraph.nodes.find((n) => n.node_id === "n3_native")!.native_file!;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <StatusChip tone="violet" label={`Native · ${nf.name}`} />
        {nf.confirmed_active ? (
          <StatusChip tone="green" dot label="Native Active" />
        ) : (
          <StatusChip tone="neutral" label="Native Inert" />
        )}
        <span className="font-mono text-[10.5px] text-ink-faint">
          {runtime ? "Vader runtime" : "Yoda static"}
        </span>
      </div>
      <dl className="space-y-1 rounded-md border border-edge-faint bg-bg-void/50 p-3 font-mono text-[11px] text-ink-muted">
        <Row k="native_id" v={nf.native_id} />
        <Row k="sha256" v={nf.sha256} />
        {nf.exported_symbol && <Row k="export" v={nf.exported_symbol} />}
      </dl>
      <p className="text-[12px] italic text-ink-secondary">{nf.activity_note}</p>
    </div>
  );
}

function PayloadDetail({ payloadId }: { payloadId: string }) {
  const p = extractedPayloads.find((x) => x.payload_id === payloadId);
  if (!p) return <Empty text="payload not found" />;
  return (
    <div className="space-y-2">
      <StatusChip tone="red" dot label="Extracted payload" />
      <PayloadCard payload={p} />
    </div>
  );
}

function ApkDetail() {
  const id = missionContext.case_identity;
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
        to locate the loaded <span className="font-mono text-accent-violet">libcloak.so</span> base address
        before hooking its JNI export.
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

function DetailPane({ node }: { node: FsNode | undefined }) {
  if (!node || !node.detail || (!node.children && !node.present)) {
    return <Empty text="select a file on any machine to extract its static or dynamic evidence" />;
  }
  const d = node.detail;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 border-b border-edge-faint pb-2">
        <span className="font-mono text-[11px] text-ink-faint">path</span>
        <span className="break-all font-mono text-[12px] text-ink-primary">{node.path}</span>
      </div>
      {d.type === "source" && <SourceDetail filePath={d.filePath} />}
      {d.type === "artifact" && <ArtifactDetail artifactPath={d.artifactPath} />}
      {d.type === "message" && <MessageDetail which={d.which} />}
      {d.type === "native" && <NativeDetail runtime={d.runtime} />}
      {d.type === "payload" && <PayloadDetail payloadId={d.payloadId} />}
      {d.type === "apk" && <ApkDetail />}
      {d.type === "proc" && <ProcDetail />}
    </div>
  );
}

// ---- the explorer -----------------------------------------------------
const POLL_MS = 2500;

export function BridgeExplorer() {
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<BridgePhase>({
    missionInYodaOutbox: false,
    missionInVaderInbox: false,
    evidenceInVaderOutbox: false,
    evidenceInYodaInbox: false,
  });
  const [busy, setBusy] = useState(false);

  // Read both machines' REAL mailbox state off disk and poll. On a single dev
  // box both states live on the same disk; on two machines each would report
  // only its own mailboxes.
  const refresh = useCallback(async () => {
    const [yodaRes, vaderRes] = await Promise.all([
      fetch("/api/bridge/state?role=yoda", { cache: "no-store" }),
      fetch("/api/bridge/state?role=vader", { cache: "no-store" }),
    ]);
    const yoda = (await yodaRes.json()) as BridgeStateDTO;
    const vader = (await vaderRes.json()) as BridgeStateDTO;
    setPhase({
      missionInYodaOutbox: yoda.missionInOutbox,
      missionInVaderInbox: !!vader.mission,
      evidenceInVaderOutbox: vader.evidenceInOutbox,
      evidenceInYodaInbox: !!yoda.evidence,
    });
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const runDemo = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/bridge/demo", { method: "POST" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const reset = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/bridge/reset", { method: "POST" });
      setSelected(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const allDone =
    phase.missionInYodaOutbox && phase.evidenceInVaderOutbox && phase.evidenceInYodaInbox;
  const fs = buildFilesystems(phase);

  const selectedNode = selected
    ? findNode(fs.yoda, selected) ??
      findNode(fs.bridge, selected) ??
      findNode(fs.vader, selected)
    : undefined;

  return (
    <div className="space-y-4">
      {/* controls + legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-bg-panel/60 px-4 py-3">
        <div className="flex items-center gap-3 font-mono text-[11px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent-green" /> present
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-edge" /> pending
          </span>
          <span className="text-ink-faint">
            files reflect what is actually on each machine&apos;s bridge disk
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!allDone && (
            <button
              onClick={runDemo}
              disabled={busy}
              className="rounded-md border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-1.5 font-mono text-[12px] text-accent-cyan transition-colors hover:bg-accent-cyan/20 disabled:opacity-50"
            >
              {busy ? "running…" : "▶ run full transfer (real round trip)"}
            </button>
          )}
          <button
            onClick={reset}
            disabled={busy}
            className="rounded-md border border-edge px-3 py-1.5 font-mono text-[12px] text-ink-muted transition-colors hover:text-ink-secondary disabled:opacity-50"
          >
            ↺ reset
          </button>
        </div>
      </div>

      {/* three machine panels */}
      <div className="grid gap-3 lg:grid-cols-3">
        {PANELS.map((p) => (
          <div key={p.side} className={`overflow-hidden rounded-xl border bg-bg-card/70 ${p.ring}`}>
            <div className="flex items-baseline justify-between border-b border-edge-faint px-3 py-2">
              <span className={`font-mono text-[12px] font-semibold ${p.accent}`}>{p.title}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                {p.role}
              </span>
            </div>
            <div className="max-h-[420px] overflow-auto px-1.5 py-1.5">
              <FileTree root={fs[p.side]} selected={selected} onSelect={setSelected} />
            </div>
          </div>
        ))}
      </div>

      {/* detail pane */}
      <div className="rounded-xl border border-edge bg-bg-card/70 p-4">
        <DetailPane node={selectedNode} />
      </div>
    </div>
  );
}
