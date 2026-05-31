"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusChip } from "./StatusChip";
import type { TransferLogEntry } from "@/lib/bridge-fs";
import { groupTransfers, type MissionView } from "@/lib/transferView";

// Multi-package view of this machine's transfer ledger: grouped by package →
// mission(version), with conflict flags (2 versions of one package coexist),
// duplicate-carry flags, completeness, and a per-mission "mark done".
export function TransferLedger() {
  const [log, setLog] = useState<TransferLogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/bridge/transfers", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setLog(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function markDone(mission_id: string, done: boolean) {
    setBusy(mission_id);
    try {
      await fetch("/api/bridge/transfers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mission_id, done }),
      });
      refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!log.length) return null;
  const groups = groupTransfers(log);

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline gap-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Transfer ledger · by package</p>
        <span className="font-mono text-[11px] text-ink-faint">
          {groups.length} package{groups.length > 1 ? "s" : ""} · {log.length} transfers
        </span>
      </div>

      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.package_name} className="overflow-hidden rounded-xl border border-edge bg-bg-card/70">
            <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-bg-panel/60 px-3 py-2">
              <span className="font-mono text-[12.5px] font-semibold text-ink-primary">{g.package_name}</span>
              <span className="font-mono text-[11px] text-ink-faint">
                {g.missions.length} mission{g.missions.length > 1 ? "s" : ""}
              </span>
              {g.conflict && (
                <StatusChip
                  tone="amber"
                  label={`${g.versionCount} versions/instances`}
                  title="Same package_name across multiple versions/missions — they coexist, keyed by mission_id"
                />
              )}
            </div>
            <ul>
              {g.missions.map((m) => (
                <MissionRow key={m.mission_id} m={m} busy={busy === m.mission_id} onToggleDone={markDone} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function MissionRow({
  m,
  busy,
  onToggleDone,
}: {
  m: MissionView;
  busy: boolean;
  onToggleDone: (missionId: string, done: boolean) => void;
}) {
  return (
    <li className="flex flex-col gap-1.5 border-t border-edge-faint px-3 py-2.5 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-ink-secondary">{m.mission_id}</span>
        {m.version_name && (
          <span className="rounded border border-edge bg-bg-raised px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
            v{m.version_name}
            {m.version_code != null ? ` (${m.version_code})` : ""}
          </span>
        )}
        {/* pull state: which legs of the carry have landed */}
        <StatusChip tone={m.hasMission ? "cyan" : "neutral"} label="mission" title="mission bundle pulled (imported)" />
        <StatusChip tone={m.hasEvidence ? "violet" : "neutral"} label="evidence" title="evidence bundle pulled back" />
        <StatusChip tone={m.complete ? "green" : "amber"} dot label={m.complete ? "complete" : "in-progress"} />
        {m.duplicate && <StatusChip tone="amber" label="duplicate carry" />}

        <span className="ml-auto flex items-center gap-2">
          {m.done ? (
            <>
              <StatusChip tone="green" dot label="DONE" />
              <button
                onClick={() => onToggleDone(m.mission_id, false)}
                disabled={busy}
                className="rounded border border-edge px-2 py-0.5 font-mono text-[10px] text-ink-faint hover:text-ink-secondary disabled:opacity-50"
              >
                reopen
              </button>
            </>
          ) : (
            <button
              onClick={() => onToggleDone(m.mission_id, true)}
              disabled={busy || !m.complete}
              title={m.complete ? "Mark this investigation done" : "Evidence not complete yet"}
              className="rounded-md border border-accent-green/40 bg-accent-green/10 px-2.5 py-1 font-mono text-[11px] text-accent-green transition-colors hover:bg-accent-green/20 disabled:opacity-40"
            >
              {busy ? "…" : "✓ Mark done"}
            </button>
          )}
        </span>
      </div>
    </li>
  );
}
