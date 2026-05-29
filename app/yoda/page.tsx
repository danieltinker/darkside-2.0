"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, session } from "@/lib/session";
import {
  missionContext,
  evidenceReturn,
  artifactContent,
  extractedPayloads,
  foundUrls,
} from "@/lib/mock";
import { reconcile } from "@/lib/reconcile";
import { ensureSeeded } from "@/lib/seed";
import { recordTpMany, snapshot } from "@/lib/known-urls";
import { MissionCard } from "@/components/MissionCard";
import { PayloadCard } from "@/components/PayloadCard";
import { NodeHumanControl, HumanReviewPanel } from "@/components/HumanReview";
import { TopNav } from "@/components/TopNav";

function ResetButton() {
  return (
    <button
      onClick={() => session.reset()}
      className="rounded-md border border-edge px-2 py-1 font-mono text-[11px] text-ink-muted transition-colors hover:border-edge-strong hover:text-ink-secondary"
    >
      ↺ reset flow
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

function StaticMode() {
  const recon = reconcile(missionContext, undefined, { includeDynamic: false });
  const flow = missionContext.flow;
  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-yoda">
            Yoda · static / mission control
          </p>
          <h1 className="mt-1 text-xl font-semibold text-ink-primary">
            Confirm the static chain, then send the mission
          </h1>
        </div>
        <ResetButton />
      </div>

      {/* Send panel */}
      <div className="mb-5 rounded-xl border border-yoda/30 bg-yoda/[0.04] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            <ChecklistRow label={`${flow.nodes.length} / ${flow.nodes.length} static signatures located`} />
            <ChecklistRow label={`${flow.required_nodes.length} boundary nodes set (gate the strong-8)`} />
            <ChecklistRow label="Decryptor recovered the cleartext URL (base64 + XOR)" />
            <ChecklistRow label="libcloak.so identified as native dispatch" />
            <ChecklistRow label="Known-URL check: domain corroborated (go.offerwall-aff.net)" />
            <ChecklistRow label="QueueLock held; identity resolved" />
          </ul>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => session.sendMission()}
              className="rounded-lg border border-yoda/50 bg-yoda/15 px-5 py-2.5 font-mono text-[13px] font-semibold text-yoda transition-colors hover:bg-yoda/25"
            >
              Send mission to Darth Vader →
            </button>
            <span className="font-mono text-[10.5px] text-ink-faint">
              writes MissionContext to bridge/yoda_outbox
            </span>
          </div>
        </div>
      </div>

      <MissionCard
        mission={missionContext}
        recon={recon}
        artifactContent={artifactContent}
        status="STATIC_CONFIRMED"
        showDynamic={false}
      />
    </main>
  );
}

function SentMode() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <div className="rounded-2xl border border-edge bg-bg-card/80 p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-accent-cyan/40 bg-accent-cyan/10">
          <span className="text-accent-cyan">⇄</span>
        </div>
        <h1 className="text-xl font-semibold text-ink-primary">Mission sent over PixelBridge</h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-ink-secondary">
          The MissionContext is in <span className="font-mono text-ink-primary">vader_inbox</span>.
          Darth Vader can now re-confirm the static signatures, run the app, and
          attach per-node evidence.
        </p>

        <dl className="mx-auto mt-5 max-w-md space-y-1.5 rounded-lg border border-edge-faint bg-bg-void/60 p-4 text-left font-mono text-[11px]">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">mission_id</dt>
            <dd className="text-ink-secondary">{missionContext.mission_id}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">schema</dt>
            <dd className="text-ink-secondary">{missionContext.schema_version}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">checksum</dt>
            <dd className="break-all text-ink-secondary">{missionContext.checksum.slice(0, 32)}…</dd>
          </div>
        </dl>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/vader"
            className="rounded-lg border border-vader/50 bg-vader/15 px-5 py-2.5 font-mono text-[13px] font-semibold text-vader transition-colors hover:bg-vader/25"
          >
            Open Darth Vader to run it →
          </Link>
          <button
            onClick={() => session.reset()}
            className="rounded-lg border border-edge px-4 py-2.5 font-mono text-[12px] text-ink-muted hover:text-ink-secondary"
          >
            ↺ reset
          </button>
        </div>
      </div>
    </main>
  );
}

function ReconciledMode() {
  const s = useSession();
  const recon = reconcile(missionContext, evidenceReturn, {
    humanConfirmations: s.human?.node_confirmations,
    verdictOverride: s.human?.verdict_override,
  });

  // Known-URL write-back: when the case reaches confirmed_tp (agent score or
  // human flip), record every found URL. Records once; the next render sees
  // the URL as a known hit (badge upgrades from domain → exact URL).
  const recorded = useRef(false);
  const [dbNote, setDbNote] = useState<{ addedCount: number; total: number } | null>(null);
  useEffect(() => {
    if (recon.effectiveVerdict === "confirmed_tp" && !recorded.current) {
      const res = recordTpMany(
        foundUrls,
        missionContext.mission_id,
        missionContext.case_identity.package_name,
      );
      recorded.current = true;
      setDbNote({ addedCount: res.addedCount, total: snapshot().length });
    }
  }, [recon.effectiveVerdict]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-yoda">
            Yoda · reconcile
          </p>
          <h1 className="mt-1 text-xl font-semibold text-ink-primary">
            Reconciled proof — {missionContext.case_identity.package_name}
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-ink-secondary">
            Vader returned evidence. Verify the static↔dynamic chain node by
            node and flip the verdict if the proof doesn&apos;t convince you — the
            score auto-updates.
          </p>
        </div>
        <ResetButton />
      </div>

      {extractedPayloads.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            Extracted payloads
          </p>
          <div className="grid gap-3">
            {extractedPayloads.map((p) => (
              <PayloadCard key={p.payload_id} payload={p} />
            ))}
          </div>
        </div>
      )}

      <MissionCard
        mission={missionContext}
        recon={recon}
        artifactContent={artifactContent}
        status="SCORED"
        renderHumanControls={(rn) => (
          <NodeHumanControl rn={rn} human={s.human} onSet={session.setNodeConfirmation} />
        )}
        footerExtra={
          <HumanReviewPanel
            recon={recon}
            human={s.human}
            onFlip={session.flipVerdict}
            onClear={session.clearHuman}
            dbNote={dbNote}
          />
        }
      />
    </main>
  );
}

export default function YodaPage() {
  ensureSeeded();
  const s = useSession();

  return (
    <div className="min-h-screen">
      <TopNav active="yoda" />
      {!s.missionSent ? (
        <StaticMode />
      ) : !s.evidenceReturned ? (
        <SentMode />
      ) : (
        <ReconciledMode />
      )}
    </div>
  );
}
