"use client";

import { useEffect, useRef, useState } from "react";
import { useBridge, useHuman, humanStore, type ImportResultDTO } from "@/lib/session";
import { missionContext, artifactContent as staticArtifactContent } from "@/lib/mock";
import { reconcile } from "@/lib/reconcile";
import { ensureSeeded } from "@/lib/seed";
import { recordTpMany, snapshot } from "@/lib/known-urls";
import { MissionCard } from "@/components/MissionCard";
import { PayloadCard } from "@/components/PayloadCard";
import { NodeHumanControl, HumanReviewPanel } from "@/components/HumanReview";
import { TopNav } from "@/components/TopNav";
import { DevicePanel, ExportButton, ImportButton, ImportReceipt } from "@/components/DeviceBar";

// Seed the known-URL DB once so server and client lookups agree.
ensureSeeded();

type Bridge = ReturnType<typeof useBridge>;

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <button
      onClick={onReset}
      className="rounded-md border border-edge px-2 py-1 font-mono text-[11px] text-ink-muted transition-colors hover:border-edge-strong hover:text-ink-secondary"
    >
      ↺ reset bridge
    </button>
  );
}

function ChecklistRow({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2 text-[12.5px] text-ink-secondary">
      <span className="mt-0.5 text-accent-green">✓</span>
      {label}
    </li>
  );
}

// ---- Phase 1: author static chain, stage to outbox, export the device file,
//      and stand by to import Vader's returned evidence bundle. -------------
function StaticMode({ b }: { b: Bridge }) {
  const [imp, setImp] = useState<ImportResultDTO | null>(null);
  // Yoda renders its OWN static analysis (local authoring) until the mission
  // has been staged; once staged, it renders the staged copy from the outbox.
  const mission = b.data?.mission ?? missionContext;
  const recon = reconcile(mission, undefined, { includeDynamic: false });
  const flow = mission.flow;
  const staged = b.data?.missionInOutbox ?? false;

  async function onImport(f: File) {
    const r = await b.importFile(f);
    setImp(r);
  }

  return (
    <main className="mx-auto max-w-6xl px-5 pt-6 pb-24">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-yoda">
            Yoda · static / mission control
          </p>
          <h1 className="mt-1 text-xl font-semibold text-ink-primary">
            Confirm the static chain, stage the mission, carry it on the device
          </h1>
        </div>
        <ResetButton onReset={b.reset} />
      </div>

      <div className="mb-5 rounded-xl border border-yoda/30 bg-yoda/[0.04] p-5">
        <ul className="grid gap-1.5 sm:grid-cols-2">
          <ChecklistRow label={`${flow.nodes.length} / ${flow.nodes.length} static signatures located`} />
          <ChecklistRow label={`${flow.required_nodes.length} boundary nodes set (gate the strong-8)`} />
          <ChecklistRow label="Decryptor recovered the cleartext URL (base64 + XOR)" />
          <ChecklistRow label="libcloak.so identified as native dispatch" />
          <ChecklistRow label="Known-URL check: domain corroborated (go.offerwall-aff.net)" />
          <ChecklistRow label="QueueLock held; identity resolved" />
        </ul>
      </div>

      <DevicePanel
        title="PixelBridge · device transport (airgapped)"
        subtitle="Stage the MissionContext into this machine's bridge/yoda_outbox, then export the single bundle file and carry it on the device to Darth Vader's machine. When Vader returns, import the evidence bundle here."
        note={b.note}
      >
        {!staged ? (
          <ExportButton
            label={b.busy ? "Staging…" : "Stage mission → yoda_outbox"}
            tone="yoda"
            onExport={b.produceMission}
            hint="writes bridge/yoda_outbox/<id>.MissionContext.json"
          />
        ) : (
          <ExportButton
            label="⬇ Export mission bundle"
            tone="yoda"
            onExport={() => b.exportBundle("mission")}
            hint={`checksum ${mission.checksum.slice(0, 16)}… · carry to Vader`}
          />
        )}
        <ImportButton
          label="⬆ Import evidence bundle"
          onFile={onImport}
          hint="from Vader, carried back on the device"
        />
      </DevicePanel>
      <ImportReceipt result={imp} />

      <MissionCard
        mission={mission}
        recon={recon}
        artifactContent={staticArtifactContent}
        status="STATIC_CONFIRMED"
        showDynamic={false}
      />
    </main>
  );
}

// ---- Phase 2: evidence is in yoda_inbox → reconcile + score. --------------
function ReconciledMode({ b }: { b: Bridge }) {
  const human = useHuman();
  const mission = b.data?.mission ?? missionContext;
  const evidence = b.data!.evidence!;
  const artifactContent = b.data!.artifactContent;
  const recon = reconcile(mission, evidence, {
    humanConfirmations: human?.node_confirmations,
    verdictOverride: human?.verdict_override,
  });

  const recorded = useRef(false);
  const [dbNote, setDbNote] = useState<{ addedCount: number; total: number } | null>(null);
  useEffect(() => {
    if (recon.effectiveVerdict === "confirmed_tp" && !recorded.current) {
      const res = recordTpMany(
        evidence.found_urls,
        mission.mission_id,
        mission.case_identity.package_name,
      );
      recorded.current = true;
      setDbNote({ addedCount: res.addedCount, total: snapshot().length });
    }
  }, [recon.effectiveVerdict, evidence, mission]);

  return (
    <main className="mx-auto max-w-6xl px-5 pt-6 pb-24">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-yoda">Yoda · reconcile</p>
          <h1 className="mt-1 text-xl font-semibold text-ink-primary">
            Reconciled proof — {mission.case_identity.package_name}
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-ink-secondary">
            Evidence imported from the device and verified locally. Confirm the static↔dynamic
            chain node by node and flip the verdict if it doesn&apos;t convince you.
          </p>
        </div>
        <ResetButton onReset={b.reset} />
      </div>

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
        status="SCORED"
        renderHumanControls={(rn) => (
          <NodeHumanControl rn={rn} human={human} onSet={humanStore.setNodeConfirmation} />
        )}
        footerExtra={
          <HumanReviewPanel
            recon={recon}
            human={human}
            onFlip={humanStore.flipVerdict}
            onClear={humanStore.clearHuman}
            dbNote={dbNote}
          />
        }
      />
    </main>
  );
}

export default function YodaPage() {
  const b = useBridge("yoda");
  const hasEvidence = !!b.data?.evidence;

  return (
    <div className="min-h-screen">
      <TopNav active="yoda" />
      {hasEvidence ? <ReconciledMode b={b} /> : <StaticMode b={b} />}
    </div>
  );
}
