"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { StatusChip } from "@/components/StatusChip";
import { caseQueue } from "@/lib/cases";
import {
  AGENT_LABEL,
  AGENT_TONE,
  effectiveAgentStatus,
  effectiveInstalled,
  type AgentStatus,
} from "@/lib/caseView";
import type { CaseRuntime } from "@/lib/caseStatus";

export default function AgentPage() {
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

  // Every case that has an agent assigned (running, waiting, or done) — running/waiting first.
  const ORDER: Record<AgentStatus, number> = {
    static_running: 0, dynamic_running: 0, static_waiting: 1, static_done: 2, dynamic_done: 2, idle: 9,
  };
  const active = caseQueue
    .map((c) => ({ c, rt: runtime[c.case_id], agent: effectiveAgentStatus(c.status, !!c.traced, runtime[c.case_id]) }))
    .filter((x) => x.agent !== "idle")
    .sort((a, b) => ORDER[a.agent] - ORDER[b.agent]);

  return (
    <div className="min-h-screen">
      <TopNav active="agent" />
      <main className="w-full px-6 lg:px-10 py-10">
        <div className="max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent-green">Analysis agents · human-in-the-loop</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary">Active agents.</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
            Install &amp; Decompile arms the agent (<span className="text-accent-amber">waiting for dispatch</span>). You
            dispatch it <span className="text-ink-primary">manually</span> per its gem; it reports{" "}
            <span className="text-accent-cyan">running</span> →{" "}
            <span className="text-accent-green">done static</span>. Pushing to the device runs the{" "}
            <span className="text-accent-violet">dynamic</span> investigation on Vader. The controls below stand in for
            those agent status reports until the real agent is plugged in.
          </p>
        </div>

        {active.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-edge bg-bg-card/50 p-10 text-center">
            <p className="font-mono text-[12px] text-ink-muted">
              No agents assigned. Start one from the{" "}
              <Link href="/queue" className="text-accent-cyan hover:underline">Queue</Link> with Install &amp; Decompile.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {active.map(({ c, rt, agent }) => {
              const installed = effectiveInstalled(c.status, rt);
              const decompile = rt?.decompile ?? "ok"; // seeded cases imply a good slice
              const isBusy = busy === c.case_id;
              return (
                <div key={c.case_id} className="rounded-xl border border-edge bg-bg-card/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-ink-primary">{c.identity.package_name}</span>
                    {rt?.escalated && <StatusChip tone="amber" label="escalated" />}
                    <StatusChip
                      tone={AGENT_TONE[agent]}
                      dot
                      pulse={agent === "static_running" || agent === "dynamic_running"}
                      label={`agent · ${AGENT_LABEL[agent]}`}
                    />
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-faint">{c.rubric_name}</p>

                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <Stat k="APK" ok={installed} label={installed ? "installed" : "—"} />
                    <Stat k="Slice" ok={decompile === "ok"} bad={decompile === "failed"} label={decompile === "ok" ? "100%" : decompile === "failed" ? "failed" : "—"} />
                    <Stat k="Device fs" ok={rt?.device_synced || agent === "dynamic_running" || agent === "dynamic_done"} label={rt?.device_synced || agent.startsWith("dynamic") ? "synced" : "—"} />
                  </dl>

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

                  {/* Agent run-status reports (placeholder) + transport */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {agent === "static_waiting" && (
                      <ReportBtn label="agent ▶ running" busy={isBusy} onClick={() => post(c.case_id, { action: "agent_report", run: "static_running" })} />
                    )}
                    {agent === "static_running" && (
                      <ReportBtn label="agent ✓ done static" busy={isBusy} onClick={() => post(c.case_id, { action: "agent_report", run: "static_done" })} />
                    )}
                    {agent === "static_done" && (
                      <button
                        onClick={() => post(c.case_id, { action: "push_device" })}
                        disabled={isBusy}
                        title="Push to the device over PixelBridge (syncs the device filesystem) → dynamic investigation"
                        className="rounded-md border border-vader/50 bg-vader/10 px-3 py-1.5 font-mono text-[12px] font-medium text-vader transition-colors hover:bg-vader/20 disabled:opacity-40"
                      >
                        {isBusy ? "Pushing…" : "⇄ Push to device (PixelBridge)"}
                      </button>
                    )}
                    {agent === "dynamic_running" && (
                      <ReportBtn label="agent ✓ done dynamic" tone="violet" busy={isBusy} onClick={() => post(c.case_id, { action: "agent_report", run: "dynamic_done" })} />
                    )}
                    {agent === "dynamic_done" && c.traced && (
                      <Link href="/vader" className="font-mono text-[11px] text-vader hover:underline">open Vader →</Link>
                    )}
                    {installed && (
                      <button
                        onClick={() => post(c.case_id, { action: "uninstall" })}
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
        )}
      </main>
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
