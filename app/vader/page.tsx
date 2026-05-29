"use client";

import { useState } from "react";
import { useBridge, type ImportResultDTO } from "@/lib/session";
import { reconcile } from "@/lib/reconcile";
import { ensureSeeded } from "@/lib/seed";
import { MissionCard } from "@/components/MissionCard";
import { PayloadCard } from "@/components/PayloadCard";
import { TopNav } from "@/components/TopNav";
import { StatusChip } from "@/components/StatusChip";
import { DevicePanel, ExportButton, ImportButton, ImportReceipt } from "@/components/DeviceBar";
import type { EvidenceReturn } from "@/lib/contract";

// Seed the known-URL DB once so server and client lookups agree.
ensureSeeded();

type Bridge = ReturnType<typeof useBridge>;

// ---- Phase 0: nothing carried in yet. -------------------------------------
function NoMission({ b }: { b: Bridge }) {
  const [imp, setImp] = useState<ImportResultDTO | null>(null);
  async function onImport(f: File) {
    setImp(await b.importFile(f));
  }
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <div className="rounded-2xl border border-dashed border-edge bg-bg-card/50 p-10 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-vader">
          Darth Vader · dynamic lab
        </p>
        <h1 className="mt-2 text-xl font-semibold text-ink-primary">No mission on this machine</h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-ink-secondary">
          This lab is airgapped. Import the MissionContext bundle Yoda exported and carried over
          on the device — it lands in this machine&apos;s bridge/vader_inbox.
        </p>
        <div className="mt-6 flex justify-center">
          <ImportButton
            label="⬆ Import mission bundle"
            onFile={onImport}
            hint="darkbridge-mission-<id>.json from the device"
          />
        </div>
        <div className="mx-auto mt-4 max-w-md">
          <ImportReceipt result={imp} />
        </div>
      </div>
    </main>
  );
}

function EvidenceSummary({ evidence }: { evidence: EvidenceReturn }) {
  const native = evidence.native_files.find((n) => n.confirmed_active);
  return (
    <div className="mb-5 grid gap-3 md:grid-cols-3">
      <div className="rounded-xl border border-edge bg-bg-card/70 p-4">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-muted">
          Experiment iterations
        </span>
        <div className="mt-1 font-mono text-2xl font-semibold text-ink-primary">
          {evidence.iterations}
        </div>
        <p className="mt-0.5 text-[11.5px] text-ink-muted">all boundary nodes confirmed</p>
      </div>
      <div className="rounded-xl border border-edge bg-bg-card/70 p-4">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-muted">
          Native path
        </span>
        <div className="mt-2">
          {native ? (
            <StatusChip tone="green" dot label={`${native.name} · Active`} />
          ) : (
            <StatusChip tone="neutral" label="Inert" />
          )}
        </div>
        <p className="mt-1.5 font-mono text-[10.5px] text-ink-muted">{native?.exported_symbol}</p>
      </div>
      <div className="rounded-xl border border-edge bg-bg-card/70 p-4">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-muted">
          Affiliate URLs observed
        </span>
        <ul className="mt-1.5 space-y-1">
          {evidence.found_urls.map((u) => (
            <li key={u} className="break-all font-mono text-[11px] text-accent-red">
              {u}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---- Phase 1/2: mission imported → re-confirm, run, export evidence. ------
function WorkingMode({ b }: { b: Bridge }) {
  const mission = b.data!.mission!;
  const evidence = b.data?.evidence ?? null;
  const artifactContent = b.data!.artifactContent;
  const ran = !!evidence;

  if (!ran) {
    const recon = reconcile(mission, undefined, { includeDynamic: false });
    return (
      <main className="mx-auto max-w-6xl px-5 py-6">
        <div className="mb-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-vader">
            Darth Vader · dynamic lab
          </p>
          <h1 className="mt-1 text-xl font-semibold text-ink-primary">
            Mission received — re-confirm, then run
          </h1>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-vader/30 bg-vader/[0.04] p-5">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-secondary">
            <StatusChip tone="green" label={`Static re-confirmed ${mission.flow.nodes.length}/${mission.flow.nodes.length}`} />
            <span className="text-ink-faint">·</span>
            <span className="font-mono text-[11.5px] text-ink-muted">
              checksum verified · {mission.mission_id}
            </span>
          </div>
          <button
            onClick={b.produceEvidence}
            disabled={b.busy}
            className="rounded-lg border border-vader/50 bg-vader/15 px-5 py-2.5 font-mono text-[13px] font-semibold text-vader transition-colors hover:bg-vader/25 disabled:opacity-50"
          >
            {b.busy ? "Running…" : "▶ Run dynamic experiments (Frida)"}
          </button>
        </div>

        <MissionCard
          mission={mission}
          recon={recon}
          artifactContent={artifactContent}
          status="RECEIVED"
          showDynamic={false}
        />
      </main>
    );
  }

  const recon = reconcile(mission, evidence);
  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-vader">
            Darth Vader · evidence captured
          </p>
          <h1 className="mt-1 text-xl font-semibold text-ink-primary">
            All nodes confirmed — export the evidence to carry back
          </h1>
        </div>
      </div>

      <DevicePanel
        title="PixelBridge · device transport (airgapped)"
        subtitle="Evidence materialized as real files in bridge/vader_outbox + bridge/artifacts. Export the single bundle and carry it on the device back to Yoda."
        note={b.note}
      >
        <ExportButton
          label="⬇ Export evidence bundle"
          tone="vader"
          onExport={() => b.exportBundle("evidence")}
          hint={`checksum ${evidence.checksum.slice(0, 16)}… · carry to Yoda`}
        />
        <button
          onClick={b.reset}
          className="rounded-lg border border-edge px-4 py-2.5 font-mono text-[12px] text-ink-muted hover:text-ink-secondary"
        >
          ↺ reset bridge
        </button>
      </DevicePanel>

      <EvidenceSummary evidence={evidence} />

      {evidence.extracted_payloads.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            Extracted payloads
          </p>
          <div className="grid gap-3">
            {evidence.extracted_payloads.map((p) => (
              <PayloadCard key={p.payload_id} payload={p} />
            ))}
          </div>
        </div>
      )}

      <MissionCard
        mission={mission}
        recon={recon}
        artifactContent={artifactContent}
        status="DYNAMIC_RUNNING"
      />
    </main>
  );
}

export default function VaderPage() {
  const b = useBridge("vader");
  const hasMission = !!b.data?.mission;

  return (
    <div className="min-h-screen">
      <TopNav active="vader" />
      {hasMission ? <WorkingMode b={b} /> : <NoMission b={b} />}
    </div>
  );
}
