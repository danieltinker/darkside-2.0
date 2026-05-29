"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, session } from "@/lib/session";
import {
  missionContext,
  evidenceReturn,
  artifactContent,
  extractedPayloads,
} from "@/lib/mock";
import { readMissionForVader } from "@/lib/bridge";
import { reconcile } from "@/lib/reconcile";
import { ensureSeeded } from "@/lib/seed";
import { MissionCard } from "@/components/MissionCard";
import { PayloadCard } from "@/components/PayloadCard";
import { TopNav } from "@/components/TopNav";
import { StatusChip } from "@/components/StatusChip";

function NoMission() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <div className="rounded-2xl border border-dashed border-edge bg-bg-card/50 p-10 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-vader">
          Darth Vader · dynamic lab
        </p>
        <h1 className="mt-2 text-xl font-semibold text-ink-primary">No mission in the inbox</h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-ink-secondary">
          Yoda hasn&apos;t shipped a MissionContext over PixelBridge yet. Open the
          Yoda console, confirm the static chain, and send the mission.
        </p>
        <Link
          href="/yoda"
          className="mt-5 inline-block rounded-lg border border-yoda/50 bg-yoda/15 px-5 py-2.5 font-mono text-[13px] font-semibold text-yoda transition-colors hover:bg-yoda/25"
        >
          ← Go to Yoda
        </Link>
      </div>
    </main>
  );
}

function EvidenceSummary() {
  const native = evidenceReturn.native_files.find((n) => n.confirmed_active);
  return (
    <div className="mb-5 grid gap-3 md:grid-cols-3">
      <div className="rounded-xl border border-edge bg-bg-card/70 p-4">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-muted">
          Experiment iterations
        </span>
        <div className="mt-1 font-mono text-2xl font-semibold text-ink-primary">
          {evidenceReturn.iterations}
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
          {evidenceReturn.found_urls.map((u) => (
            <li key={u} className="break-all font-mono text-[11px] text-accent-red">
              {u}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function WorkingMode() {
  const [ran, setRan] = useState(() => session.get().status === "DYNAMIC_RUNNING");
  const mission = readMissionForVader(missionContext.mission_id) ?? missionContext;

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
            <StatusChip tone="green" label="Static re-confirmed 9/9" />
            <span className="text-ink-faint">·</span>
            <span className="font-mono text-[11.5px] text-ink-muted">
              checksum verified · {mission.mission_id}
            </span>
          </div>
          <button
            onClick={() => {
              session.runDynamic();
              setRan(true);
            }}
            className="rounded-lg border border-vader/50 bg-vader/15 px-5 py-2.5 font-mono text-[13px] font-semibold text-vader transition-colors hover:bg-vader/25"
          >
            ▶ Run dynamic experiments (Frida)
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

  // Post-run: full evidence attached
  const recon = reconcile(mission, evidenceReturn);
  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-vader">
            Darth Vader · evidence captured
          </p>
          <h1 className="mt-1 text-xl font-semibold text-ink-primary">
            All nodes confirmed — send evidence back
          </h1>
        </div>
        <button
          onClick={() => session.sendEvidence()}
          className="rounded-lg border border-vader/50 bg-vader/15 px-5 py-2.5 font-mono text-[13px] font-semibold text-vader transition-colors hover:bg-vader/25"
        >
          Send evidence to Yoda →
        </button>
      </div>

      <EvidenceSummary />

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
        mission={mission}
        recon={recon}
        artifactContent={artifactContent}
        status="DYNAMIC_RUNNING"
      />
    </main>
  );
}

function EvidenceSentMode() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <div className="rounded-2xl border border-edge bg-bg-card/80 p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-accent-green/40 bg-accent-green/10">
          <span className="text-accent-green">✓</span>
        </div>
        <h1 className="text-xl font-semibold text-ink-primary">Evidence sent over PixelBridge</h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-ink-secondary">
          The EvidenceReturn is in <span className="font-mono text-ink-primary">yoda_inbox</span>{" "}
          with all boundary nodes confirmed. Yoda can now reconcile and score.
        </p>
        <dl className="mx-auto mt-5 max-w-md space-y-1.5 rounded-lg border border-edge-faint bg-bg-void/60 p-4 text-left font-mono text-[11px]">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">verdict</dt>
            <dd className="text-accent-green">{evidenceReturn.verdict}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">dynamic_score</dt>
            <dd className="text-ink-secondary">{evidenceReturn.dynamic_score}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">checksum</dt>
            <dd className="break-all text-ink-secondary">{evidenceReturn.checksum.slice(0, 32)}…</dd>
          </div>
        </dl>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/yoda"
            className="rounded-lg border border-yoda/50 bg-yoda/15 px-5 py-2.5 font-mono text-[13px] font-semibold text-yoda transition-colors hover:bg-yoda/25"
          >
            ← Reconcile in Yoda
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

export default function VaderPage() {
  ensureSeeded();
  const s = useSession();

  return (
    <div className="min-h-screen">
      <TopNav active="vader" />
      {!s.missionSent ? (
        <NoMission />
      ) : s.evidenceReturned ? (
        <EvidenceSentMode />
      ) : (
        <WorkingMode />
      )}
    </div>
  );
}
