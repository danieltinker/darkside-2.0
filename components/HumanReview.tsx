"use client";

import { useState } from "react";
import type { ReconciledNode, Reconciliation } from "@/lib/reconcile";
import type { HumanReview, NodeConfirmation, Verdict } from "@/lib/contract";
import { StatusChip, type ChipTone } from "./StatusChip";

// ---- Per-node confirm / reject (rendered in each NodeCard) -------------
export function NodeHumanControl({
  rn,
  human,
  onSet,
}: {
  rn: ReconciledNode;
  human?: HumanReview;
  onSet: (nodeId: string, call: NodeConfirmation | null) => void;
}) {
  const call = human?.node_confirmations[rn.node.node_id];
  const btn = (active: boolean, tone: "green" | "red") =>
    `rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors ${
      active
        ? tone === "green"
          ? "border-accent-green/50 bg-accent-green/15 text-accent-green"
          : "border-accent-red/50 bg-accent-red/15 text-accent-red"
        : "border-edge text-ink-muted hover:text-ink-secondary"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        Human review
      </span>
      <button
        onClick={() => onSet(rn.node.node_id, call === "confirmed" ? null : "confirmed")}
        className={btn(call === "confirmed", "green")}
      >
        ✓ Confirm
      </button>
      <button
        onClick={() => onSet(rn.node.node_id, call === "rejected" ? null : "rejected")}
        className={btn(call === "rejected", "red")}
      >
        ✗ Reject
      </button>
      {call === "rejected" && (
        <>
          <span className="rounded-md border border-dashed border-edge px-2 py-0.5 font-mono text-[10.5px] text-ink-muted">
            ⟳ re-run node / attach evidence
          </span>
          {rn.isRequired && (
            <span className="font-mono text-[10.5px] text-accent-red">
              boundary rejected — chain broken
            </span>
          )}
        </>
      )}
    </div>
  );
}

// ---- The reconcile panel (verdict flip + DB write-back note) -----------
const VERDICTS: { v: Verdict; label: string; tone: ChipTone }[] = [
  { v: "confirmed_tp", label: "→ Confirmed TP", tone: "green" },
  { v: "partial", label: "→ Partial", tone: "amber" },
  { v: "failed_fp", label: "→ Failed FP", tone: "red" },
];

export function HumanReviewPanel({
  recon,
  human,
  onFlip,
  onClear,
  dbNote,
}: {
  recon: Reconciliation;
  human?: HumanReview;
  onFlip: (v: Verdict, reason?: string) => void;
  onClear: () => void;
  dbNote?: { addedCount: number; total: number } | null;
}) {
  const [reason, setReason] = useState("");
  const override = human?.verdict_override;
  const rejectedRequired = recon.nodes.some(
    (n) => n.isRequired && human?.node_confirmations[n.node.node_id] === "rejected",
  );

  return (
    <div className="rounded-lg border border-edge-faint bg-bg-void/50 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-secondary">
            Human-in-the-loop
          </span>
          {human && (
            <span className="font-mono text-[10.5px] text-ink-faint">
              {human.reviewer} · {Object.keys(human.node_confirmations).length} node calls
            </span>
          )}
        </div>
        {dbNote && dbNote.addedCount > 0 && (
          <StatusChip
            tone="green"
            dot
            label={`DB updated · +${dbNote.addedCount} URL${dbNote.addedCount > 1 ? "s" : ""}`}
            title={`${dbNote.total} known riskware URLs`}
          />
        )}
      </div>

      {rejectedRequired && (
        <p className="mt-2 font-mono text-[11px] text-accent-red">
          A boundary node is rejected — the chain is broken. Flip to FAILED FP to
          record a false positive.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {VERDICTS.map(({ v, label, tone }) => {
          const active = override === v;
          const toneCls =
            tone === "green"
              ? "border-accent-green/50 bg-accent-green/15 text-accent-green"
              : tone === "red"
                ? "border-accent-red/50 bg-accent-red/15 text-accent-red"
                : "border-accent-amber/50 bg-accent-amber/15 text-accent-amber";
          return (
            <button
              key={v}
              onClick={() => onFlip(v, reason || undefined)}
              className={`rounded-md border px-3 py-1.5 font-mono text-[12px] font-medium transition-colors ${
                active ? toneCls : "border-edge text-ink-muted hover:text-ink-secondary"
              }`}
            >
              {label}
            </button>
          );
        })}
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="reason (optional)"
          className="min-w-[160px] flex-1 rounded-md border border-edge bg-bg-base px-2.5 py-1.5 font-mono text-[12px] text-ink-secondary placeholder:text-ink-faint focus:border-edge-strong focus:outline-none"
        />
        {override && (
          <button
            onClick={onClear}
            className="rounded-md border border-edge px-2.5 py-1.5 font-mono text-[11px] text-ink-muted hover:text-ink-secondary"
          >
            clear override
          </button>
        )}
      </div>

      {human?.reason && (
        <p className="mt-2 font-mono text-[11px] text-ink-muted">“{human.reason}”</p>
      )}
    </div>
  );
}
