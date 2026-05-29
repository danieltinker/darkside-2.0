import type { ReactNode } from "react";
import type { MissionContext, MissionStatus, Verdict } from "@/lib/contract";
import type { Reconciliation, ReconciledNode } from "@/lib/reconcile";
import type { ArtifactContent } from "@/lib/mock";
import { CallGraph } from "./CallGraph";
import { StatusChip, type ChipTone } from "./StatusChip";
import { BoundaryTable } from "./BoundaryTable";

const STATUS_TONE: Record<MissionStatus, ChipTone> = {
  LOCKED: "neutral",
  STATIC_CONFIRMED: "cyan",
  MISSION_SENT: "cyan",
  RECEIVED: "cyan",
  DYNAMIC_RUNNING: "amber",
  EVIDENCE_SENT: "amber",
  SCORED: "green",
};

const VERDICT: Record<Verdict, { label: string; tone: ChipTone }> = {
  confirmed_tp: { label: "Confirmed TP", tone: "green" },
  failed_fp: { label: "Failed FP", tone: "red" },
  partial: { label: "Partial", tone: "amber" },
};

function Header({
  mission,
  status,
  headerExtra,
}: {
  mission: MissionContext;
  status: MissionStatus;
  headerExtra?: ReactNode;
}) {
  const id = mission.case_identity;
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge bg-bg-panel/80 px-5 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-[15px] font-semibold text-ink-primary">{id.package_name}</h2>
          <span className="rounded border border-edge bg-bg-raised px-1.5 py-0.5 font-mono text-[10.5px] text-ink-muted">
            v{id.version_name} ({id.version_code})
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-muted">
          <span>{id.developer}</span>
          <span className="text-ink-faint">·</span>
          <span className="font-mono">{id.top_countries.join(" · ")}</span>
          <span className="text-ink-faint">·</span>
          <span className="font-mono text-ink-muted" title="QueueLockID">
            {mission.queue_lock.lock_id}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {headerExtra}
        <StatusChip tone={STATUS_TONE[status]} dot label={status.replace(/_/g, " ")} />
        <StatusChip
          tone="green"
          label={`${mission.rubric.name.includes("cloak") ? "MMP Cloaking" : mission.rubric.name} · Strong ${mission.rubric.points_if_strong}`}
        />
      </div>
    </div>
  );
}

function ScoringFooter({
  recon,
  footerExtra,
}: {
  recon: Reconciliation;
  footerExtra?: ReactNode;
}) {
  const overridden = recon.effectiveVerdict !== recon.agentVerdict;
  const v = VERDICT[recon.effectiveVerdict];
  const strong = recon.effectiveVerdict === "confirmed_tp" && recon.score === recon.maxScore;
  return (
    <div className="border-t border-edge bg-bg-panel/80 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            Boundary nodes
          </span>
          <span className="font-mono text-[13px] text-ink-primary">
            {recon.requiredConfirmedCount}/{recon.requiredNodes.length} confirmed
          </span>
          <span className="flex gap-1">
            {recon.requiredNodes.map((id) => {
              const n = recon.nodes.find((x) => x.node.node_id === id);
              const tone =
                n?.status === "confirmed"
                  ? "bg-accent-green"
                  : n?.status === "failed"
                    ? "bg-accent-red"
                    : "bg-accent-amber";
              return <span key={id} title={id} className={`h-2 w-6 rounded-full ${tone}`} />;
            })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {overridden && (
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-muted">
              {VERDICT[recon.agentVerdict].label}
              <span className="text-ink-faint">→</span>
            </span>
          )}
          <StatusChip tone={v.tone} dot label={v.label} />
          <div className="flex items-baseline gap-1">
            <span
              className={`font-mono text-2xl font-semibold tabular-nums ${
                strong ? "text-accent-green" : recon.score === 0 ? "text-ink-muted" : "text-accent-amber"
              }`}
            >
              {recon.score}
            </span>
            <span className="font-mono text-sm text-ink-faint">/ {recon.maxScore}</span>
          </div>
          {strong && <StatusChip tone="green" label="Strong 8" />}
        </div>
      </div>
      {footerExtra && <div className="mt-3">{footerExtra}</div>}
    </div>
  );
}

export function MissionCard({
  mission,
  recon,
  artifactContent,
  status,
  showDynamic = true,
  headerExtra,
  footerExtra,
  renderHumanControls,
}: {
  mission: MissionContext;
  recon: Reconciliation;
  artifactContent: Record<string, ArtifactContent>;
  status?: MissionStatus;
  showDynamic?: boolean;
  headerExtra?: ReactNode;
  footerExtra?: ReactNode;
  renderHumanControls?: (rn: ReconciledNode) => ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-edge bg-bg-base/60 shadow-card">
      <Header mission={mission} status={status ?? mission.status} headerExtra={headerExtra} />
      <div className="bg-grid px-5 py-5">
        <CallGraph
          recon={recon}
          edges={mission.flow.edges}
          artifactContent={artifactContent}
          showDynamic={showDynamic}
          renderHumanControls={renderHumanControls}
        />
      </div>
      <div className="border-t border-edge px-5 py-4">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
          Boundary proof
        </p>
        <BoundaryTable recon={recon} />
      </div>
      <ScoringFooter recon={recon} footerExtra={footerExtra} />
    </div>
  );
}
