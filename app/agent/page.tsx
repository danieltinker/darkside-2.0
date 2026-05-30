"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { StatusChip, type ChipTone } from "@/components/StatusChip";
import { caseQueue } from "@/lib/cases";
import type { CaseRuntime, AgentStatus } from "@/lib/caseStatus";

const AGENT: Record<AgentStatus, { tone: ChipTone; label: string }> = {
  idle: { tone: "neutral", label: "idle" },
  static: { tone: "cyan", label: "Static analysis" },
  dynamic: { tone: "violet", label: "Dynamic analysis" },
};

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

  async function pushToDevice(caseId: string) {
    setBusy(caseId);
    try {
      await fetch(`/api/cases/${caseId}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "push_device" }),
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  // Cases that have entered the workbench (installed / escalated / agent active).
  const active = caseQueue
    .map((c) => ({ c, rt: runtime[c.case_id] }))
    .filter(({ rt }) => rt && (rt.installed || rt.escalated || rt.agent_status !== "idle"));

  return (
    <div className="min-h-screen">
      <TopNav active="agent" />
      <main className="w-full px-6 lg:px-10 py-10">
        <div className="max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent-green">
            Analysis agents · human-in-the-loop
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary">
            Active agents.
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
            Install &amp; Decompile arms the <span className="text-accent-cyan">Static analysis</span> agent on a
            case (this is where you <span className="text-ink-primary">manually dispatch</span> it per its gem — there
            is no auto-dispatch). Pushing the mission to the device over PixelBridge flips it to{" "}
            <span className="text-accent-violet">Dynamic analysis</span>.
          </p>
        </div>

        {active.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-edge bg-bg-card/50 p-10 text-center">
            <p className="font-mono text-[12px] text-ink-muted">
              No active agents. Start one from the{" "}
              <Link href="/queue" className="text-accent-cyan hover:underline">Queue</Link> with{" "}
              <span className="text-ink-secondary">Install &amp; Decompile</span>.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {active.map(({ c, rt }) => {
              const agent = AGENT[rt.agent_status];
              const armed = rt.decompile === "ok";
              return (
                <div key={c.case_id} className="rounded-xl border border-edge bg-bg-card/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-ink-primary">{c.identity.package_name}</span>
                    {rt.escalated && <StatusChip tone="amber" label="escalated" />}
                    <StatusChip tone={agent.tone} dot pulse={rt.agent_status !== "idle"} label={`agent · ${agent.label}`} />
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-faint">{c.rubric_name}</p>

                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <Stat k="APK" ok={rt.installed} label={rt.installed ? "installed" : "—"} />
                    <Stat k="Slice" ok={rt.decompile === "ok"} bad={rt.decompile === "failed"} label={rt.decompile === "ok" ? "100%" : rt.decompile === "failed" ? "failed" : "—"} />
                    <Stat k="Device fs" ok={rt.device_synced} label={rt.device_synced ? "synced" : "—"} />
                  </dl>

                  {/* Manual dispatch context */}
                  {armed && rt.agent_status === "static" && (
                    <div className="mt-3 rounded-md border border-yoda/30 bg-yoda/[0.05] p-2.5">
                      <p className="text-[12px] text-ink-secondary">
                        Slice ready — <span className="text-ink-primary">dispatch Sky Walker manually</span> per{" "}
                        <span className="font-mono text-[11px]">gems/riskware/skywalker.gem.md</span> against the decompiled sources.
                      </p>
                    </div>
                  )}
                  {rt.decompile === "failed" && (
                    <p className="mt-3 rounded-md border border-accent-red/40 bg-accent-red/10 px-2.5 py-2 font-mono text-[11px] text-accent-red">
                      decompilation failed — agent not armed; re-run Install &amp; Decompile.
                    </p>
                  )}

                  {/* Push to device → dynamic */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => pushToDevice(c.case_id)}
                      disabled={busy === c.case_id || !armed || rt.agent_status === "dynamic"}
                      title={!armed ? "Needs a successful slice first" : "Push to the device over PixelBridge (syncs the device filesystem) → Dynamic analysis"}
                      className="rounded-md border border-vader/50 bg-vader/10 px-3 py-1.5 font-mono text-[12px] font-medium text-vader transition-colors hover:bg-vader/20 disabled:opacity-40"
                    >
                      {busy === c.case_id ? "Pushing…" : rt.agent_status === "dynamic" ? "✓ on device (dynamic)" : "⇄ Push to device (PixelBridge)"}
                    </button>
                    {c.traced && rt.agent_status === "dynamic" && (
                      <Link href="/vader" className="font-mono text-[11px] text-vader hover:underline">open Vader →</Link>
                    )}
                  </div>

                  {rt.events.length > 0 && (
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

function Stat({ k, label, ok, bad }: { k: string; label: string; ok?: boolean; bad?: boolean }) {
  const tone = bad ? "text-accent-red" : ok ? "text-accent-green" : "text-ink-faint";
  return (
    <div className="rounded-md border border-edge bg-bg-void/40 py-1.5">
      <div className={`font-mono text-[12px] ${tone}`}>{label}</div>
      <div className="font-mono text-[9.5px] uppercase tracking-wider text-ink-faint">{k}</div>
    </div>
  );
}
