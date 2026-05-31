"use client";

import { useState } from "react";
import { TopNav } from "@/components/TopNav";
import { StatusChip } from "@/components/StatusChip";
import { CopyButton } from "@/components/CopyButton";
import { DeviceSystemHealth } from "@/components/DeviceSystemHealth";
import type { DiagReport, DiagStatus } from "@/lib/diagnostics";

const STATUS: Record<DiagStatus, { tone: "green" | "red" | "amber"; mark: string }> = {
  pass: { tone: "green", mark: "✓" },
  fail: { tone: "red", mark: "✗" },
  skip: { tone: "amber", mark: "∅" },
};

export default function DiagnosticsPage() {
  const [report, setReport] = useState<DiagReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/diagnostics", { headers: { accept: "application/json" }, cache: "no-store" });
      setReport((await res.json()) as DiagReport);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <TopNav active="diagnostics" />
      <main className="w-full px-6 lg:px-10 py-10">
        <div className="max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent-green">
            Self-check · end-to-end
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary">
            Diagnostics — is the whole flow running?
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
            Runs the full round-trip in-process — load gems → compile mission → bridge
            produce/pack/import (both directions) → reconcile → assert the golden score —
            and reports each step with timing. If something breaks in the field, run this,
            then <span className="font-mono text-accent-green">copy the report</span> (or
            send the <span className="font-mono">darkside-diagnostics-*.json</span> from{" "}
            <span className="font-mono">npm run diagnose</span>) back for a fix.
          </p>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={run}
            disabled={busy}
            className="rounded-lg border border-accent-green/50 bg-accent-green/15 px-5 py-2.5 font-mono text-[13px] font-semibold text-accent-green transition-colors hover:bg-accent-green/25 disabled:opacity-50"
          >
            {busy ? "Running…" : "▶ Run diagnostics"}
          </button>
          {report && <CopyButton text={JSON.stringify(report, null, 2)} label="⧉ copy report JSON" />}
        </div>

        {err && (
          <p className="mt-4 rounded-lg border border-accent-red/40 bg-accent-red/10 px-4 py-3 font-mono text-[12px] text-accent-red">
            {err}
          </p>
        )}

        {report && (
          <div className="mt-6 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <StatusChip
                tone={report.ok ? "green" : "red"}
                dot
                label={report.ok ? "ALL PASS" : "FAILED"}
              />
              <span className="font-mono text-[12px] text-ink-muted">
                {report.summary.passed}/{report.summary.total} passed · {report.summary.failed} failed ·{" "}
                {report.summary.skipped} skipped · {report.durationMs}ms
              </span>
              <span className="font-mono text-[11px] text-ink-faint">
                node {report.env?.node} · {report.env?.platform} · app v{report.env?.appVersion}
              </span>
            </div>

            <ol className="overflow-hidden rounded-xl border border-edge bg-bg-card/70">
              {report.steps?.map((s) => {
                const st = STATUS[s.status];
                return (
                  <li
                    key={s.id}
                    className="flex flex-col gap-1 border-t border-edge-faint px-4 py-2.5 first:border-t-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-mono text-[13px] ${st.tone === "green" ? "text-accent-green" : st.tone === "red" ? "text-accent-red" : "text-accent-amber"}`}>
                        {st.mark}
                      </span>
                      <span className="text-[13px] text-ink-primary">{s.label}</span>
                      <span className="font-mono text-[10.5px] text-ink-faint">{s.id}</span>
                      <span className="ml-auto font-mono text-[10.5px] text-ink-faint">{s.ms}ms</span>
                    </div>
                    {s.detail && (
                      <pre className="overflow-x-auto rounded bg-bg-void/60 px-2.5 py-1.5 font-mono text-[10.5px] text-ink-muted">
                        {JSON.stringify(s.detail)}
                      </pre>
                    )}
                    {s.error && (
                      <p className="font-mono text-[11px] text-accent-red">↳ {s.error}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* ---- Device system health (device + tools alive? install/dispatch gates) ---- */}
        <div className="mt-12 border-t border-edge pt-8">
          <div className="mb-5 max-w-3xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-vader">
              Device system health · all systems go?
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-primary">
              Is the device + dynamic stack ready?
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
              Probes the host: device over adb, device network, HTTP Toolkit, NordVPN
              (with country), Frida. Computes two gates —{" "}
              <span className="text-ink-primary">Install</span> (adb push from Yoda) needs only the
              device connected; <span className="text-ink-primary">Dynamic dispatch</span> (Vader)
              needs Frida + device network + HTTP Toolkit + NordVPN. See{" "}
              <span className="font-mono">docs/DYNAMIC-SETUP.md</span> / <span className="font-mono">npm run preflight</span>.
            </p>
          </div>
          <DeviceSystemHealth />
        </div>
      </main>
    </div>
  );
}
