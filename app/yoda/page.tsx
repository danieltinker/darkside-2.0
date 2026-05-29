"use client";

import { missionContext, evidenceReturn, artifactContent } from "@/lib/mock";
import { reconcile } from "@/lib/reconcile";
import { ensureSeeded } from "@/lib/seed";
import { MissionCard } from "@/components/MissionCard";
import { TopNav } from "@/components/TopNav";

export default function YodaPage() {
  ensureSeeded();
  const recon = reconcile(missionContext, evidenceReturn);

  return (
    <div className="min-h-screen">
      <TopNav active="yoda" />
      <main className="mx-auto max-w-6xl px-5 py-6">
        <div className="mb-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-yoda">
            Yoda · static / mission control
          </p>
          <h1 className="mt-1 text-xl font-semibold text-ink-primary">
            Reconciled proof — {missionContext.case_identity.package_name}
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-ink-secondary">
            One confirmed call graph: every node carries a static signature
            (Yoda) and dynamic evidence (Vader). The three boundary nodes gate
            the strong-8 score.
          </p>
        </div>
        <MissionCard
          mission={missionContext}
          recon={recon}
          artifactContent={artifactContent}
          status="SCORED"
        />
      </main>
    </div>
  );
}
