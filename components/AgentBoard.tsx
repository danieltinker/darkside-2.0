"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CaseRow } from "@/lib/caseRows";
import { StatusChip } from "@/components/StatusChip";
import {
  AGENT_LABEL,
  AGENT_TONE,
  effectiveAgentStatus,
  effectiveInstalled,
  revealsChains,
  type AgentStatus,
} from "@/lib/caseView";
import type { CaseRuntime } from "@/lib/caseStatus";

export function AgentBoard({ rows }: { rows: CaseRow[] }) {
  const [runtime, setRuntime] = useState<Record<string, CaseRuntime>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/cases", { cache: "no-store" });
      setRuntime((await res.json()) as Record<string, CaseRuntime>);
    } catch {
      /* keep prior */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function post(caseId: string, body: Record<string, unknown>) {
    setBusy(caseId);
    try {
      await fetch(`/api/cases/${caseId}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  const ORDER: Record<AgentStatus, number> = {
    static_running: 0, dynamic_running: 0, static_waiting: 1, static_done: 2, dynamic_done: 2, idle: 9,
  };
  const active = rows
    .map((row) => ({ row, rt: runtime[row.case_id], agent: effectiveAgentStatus(row.status, !!row.traced, runtime[row.case_id]) }))
    .filter((x) => x.agent !== "idle")
    .sort((a, b) => ORDER[a.agent] - ORDER[b.agent]);

  if (active.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-edge bg-bg-card/50 p-10 text-center">
        <p className="font-mono text-[12px] text-ink-muted">
          No agents assigned. Start one from the{" "}
          <Link href="/queue" className="text-accent-cyan hover:underline">Queue</Link> with Install &amp; Decompile.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-3 lg:grid-cols-2">
      {active.map(({ row, rt, agent }) => {
        const installed = effectiveInstalled(row.status, rt);
        const decompile = rt?.decompile ?? "ok";
        const scored = revealsChains(agent); // score is the output of static analysis
        const isBusy = busy === row.case_id;
        return (
          <div key={row.case_id} className="rounded-xl border border-edge bg-bg-card/70 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13px] font-semibold text-ink-primary">{row.identity.package_name}</span>
              {row.traced && <StatusChip tone="violet" label="traced" />}
              {rt?.escalated && <StatusChip tone="amber" label="escalated" />}
              <StatusChip
                tone={AGENT_TONE[agent]}
                dot
                pulse={agent === "static_running" || agent === "dynamic_running"}
                label={`agent · ${AGENT_LABEL[agent]}`}
              />
              {/* Score — the agent's output, shown once static analysis is done */}
              <span className="ml-auto flex items-baseline gap-1">
                <span
                  className={`font-mono text-xl font-semibold tabular-nums ${
                    !scored ? "text-ink-faint" : row.score >= 8 ? "text-accent-green" : row.score > 0 ? "text-accent-amber" : "text-accent-red"
                  }`}
                  title={scored ? "binary-per-chain score" : "pending — appears when static analysis is done"}
                >
                  {scored ? row.score : "—"}
                </span>
                <span className="font-mono text-[11px] text-ink-faint">{scored ? "pts" : "pending"}</span>
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-ink-faint">{row.rubric_name}</p>

            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat k="APK" ok={installed} label={installed ? "installed" : "—"} />
              <Stat k="Slice" ok={decompile === "ok"} bad={decompile === "failed"} label={decompile === "ok" ? "100%" : decompile === "failed" ? "failed" : "—"} />
              <Stat
                k="Device fs"
                ok={rt?.device_synced || agent === "dynamic_running" || agent === "dynamic_done"}
                label={rt?.device_synced || agent.startsWith("dynamic") ? "synced" : "—"}
              />
            </dl>

            {scored && (
              <div className="mt-2 font-mono text-[11px] text-ink-muted">
                {row.chains.filter((c) => c.confirmed).length}/{row.chains.length} chains confirmed ·{" "}
                {row.score >= 8 ? "confirmed TP" : row.score > 0 ? "partial" : "no findings"}
              </div>
            )}

            {agent === "static_waiting" && (
              <div className="mt-3 rounded-md border border-yoda/30 bg-yoda/[0.05] p-2.5">
                <p className="text-[12px] text-ink-secondary">
                  Slice ready — <span className="text-ink-primary">dispatch Sky Walker manually</span> per{" "}
                  <span className="font-mono text-[11px]">gems/riskware/skywalker.gem.md</span>.
                </p>
              </div>
            )}
            {decompile === "failed" && (
              <p className="mt-3 rounded-md border border-accent-red/40 bg-accent-red/10 px-2.5 py-2 font-mono text-[11px] text-accent-red">
                decompilation failed — agent not armed; re-run Install &amp; Decompile.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {agent === "static_waiting" && (
                <ReportBtn label="agent ▶ running" busy={isBusy} onClick={() => post(row.case_id, { action: "agent_report", run: "static_running" })} />
              )}
              {agent === "static_running" && (
                <ReportBtn label="agent ✓ done static" busy={isBusy} onClick={() => post(row.case_id, { action: "agent_report", run: "static_done" })} />
              )}
              {agent === "static_done" && (
                <button
                  onClick={() => post(row.case_id, { action: "push_device" })}
                  disabled={isBusy}
                  title="Push to the device over PixelBridge (syncs the device filesystem) → dynamic investigation"
                  className="rounded-md border border-vader/50 bg-vader/10 px-3 py-1.5 font-mono text-[12px] font-medium text-vader transition-colors hover:bg-vader/20 disabled:opacity-40"
                >
                  {isBusy ? "Pushing…" : "⇄ Push to device (PixelBridge)"}
                </button>
              )}
              {agent === "dynamic_running" && (
                <ReportBtn label="agent ✓ done dynamic" tone="violet" busy={isBusy} onClick={() => post(row.case_id, { action: "agent_report", run: "dynamic_done" })} />
              )}
              {agent === "dynamic_done" && row.traced && (
                <Link href="/vader" className="font-mono text-[11px] text-vader hover:underline">open Vader →</Link>
              )}
              {installed && (
                <button
                  onClick={() => post(row.case_id, { action: "uninstall" })}
                  disabled={isBusy}
                  title="Uninstall the APK from the device (placeholder)"
                  className="ml-auto rounded-md border border-edge bg-bg-raised px-3 py-1.5 font-mono text-[11px] text-ink-muted transition-colors hover:border-accent-red/50 hover:text-accent-red disabled:opacity-50"
                >
                  🗑 Uninstall
                </button>
              )}
            </div>

            {rt && rt.events.length > 0 && (
              <ol className="mt-3 space-y-1 border-l border-edge pl-3">
                {rt.events.map((e, i) => (
                  <li key={i} className="text-[11px] text-ink-muted">
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-ink-faint">{e.kind}</span> {e.detail}
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReportBtn({ label, onClick, busy, tone = "cyan" }: { label: string; onClick: () => void; busy: boolean; tone?: "cyan" | "violet" }) {
  const cls = tone === "violet" ? "border-vader/50 bg-vader/10 text-vader hover:bg-vader/20" : "border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20";
  return (
    <button onClick={onClick} disabled={busy} className={`rounded-md border px-3 py-1.5 font-mono text-[12px] font-medium transition-colors disabled:opacity-40 ${cls}`}>
      {busy ? "…" : label}
    </button>
  );
}

function Stat({ k, label, ok, bad }: { k: string; label: string; ok?: boolean; bad?: boolean }) {
  const tone = bad ? "text-accent-red" : ok ? "text-accent-green" : "text-ink-faint";
  return (
    <div className="rounded-md border border-edge bg-bg-void/40 py-1.5">
      <div className={`font-mono text-[12px] ${tone}`}>{label}</div>
      <div className="font-mono text-[9.5px] uppercase tracking-wider text-ink-faint">{k}</div>
    </div>
  );
}
