"use client";

import { useState } from "react";
import { TopNav } from "@/components/TopNav";
import { StatusChip } from "@/components/StatusChip";
import { CopyButton } from "@/components/CopyButton";
import type { DiagReport, DiagStatus } from "@/lib/diagnostics";
import type { PreflightReport, ToolStatus } from "@/lib/preflight";

const STATUS: Record<DiagStatus, { tone: "green" | "red" | "amber"; mark: string }> = {
  pass: { tone: "green", mark: "✓" },
  fail: { tone: "red", mark: "✗" },
  skip: { tone: "amber", mark: "∅" },
};

const TOOL_STATUS: Record<ToolStatus, { tone: "green" | "red" | "amber"; label: string }> = {
  alive: { tone: "green", label: "alive" },
  dead: { tone: "red", label: "down" },
  unknown: { tone: "amber", label: "confirm" },
};

export default function DiagnosticsPage() {
  const [report, setReport] = useState<DiagReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [preflight, setPreflight] = useState<PreflightReport | null>(null);
  const [pfBusy, setPfBusy] = useState(false);
  const [pfErr, setPfErr] = useState<string | null>(null);

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

  async function runPreflight() {
    setPfBusy(true);
    setPfErr(null);
    try {
      const res = await fetch("/api/preflight", { headers: { accept: "application/json" }, cache: "no-store" });
      setPreflight((await res.json()) as PreflightReport);
    } catch (e) {
      setPfErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPfBusy(false);
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

        {/* ---- Dynamic preflight (Vader machine: tools + device alive?) ---- */}
        <div className="mt-12 border-t border-edge pt-8">
          <div className="max-w-3xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-vader">
              Dynamic preflight · before a run
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-primary">
              Is the dynamic environment alive?
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
              Runs on the Vader machine — probes the connected device + tools.
              <span className="text-ink-primary"> Mandatory:</span> HTTP Toolkit, NordVPN,
              a connected device with network. <span className="text-ink-muted">Optional:</span> Frida.
              Don&apos;t start a run until mandatory tools are green. See{" "}
              <span className="font-mono">docs/DYNAMIC-SETUP.md</span> /{" "}
              <span className="font-mono">npm run preflight</span>.
            </p>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={runPreflight}
              disabled={pfBusy}
              className="rounded-lg border border-vader/50 bg-vader/15 px-5 py-2.5 font-mono text-[13px] font-semibold text-vader transition-colors hover:bg-vader/25 disabled:opacity-50"
            >
              {pfBusy ? "Probing…" : "▶ Run dynamic preflight"}
            </button>
            {preflight && <CopyButton text={JSON.stringify(preflight, null, 2)} label="⧉ copy preflight JSON" />}
          </div>

          {pfErr && (
            <p className="mt-4 rounded-lg border border-accent-red/40 bg-accent-red/10 px-4 py-3 font-mono text-[12px] text-accent-red">
              {pfErr}
            </p>
          )}

          {preflight && (
            <div className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <StatusChip tone={preflight.ok ? "green" : "red"} dot label={preflight.ok ? "READY" : "NOT READY"} />
                <span className="font-mono text-[12px] text-ink-muted">
                  mandatory {preflight.summary?.mandatoryAlive}/{preflight.summary?.mandatoryTotal} alive · optional{" "}
                  {preflight.summary?.optionalAlive} alive
                </span>
                <span className="font-mono text-[11px] text-ink-faint">
                  {preflight.env?.platform} · proxy :{preflight.env?.proxyPort}
                </span>
              </div>

              <ul className="overflow-hidden rounded-xl border border-edge bg-bg-card/70">
                {preflight.checks?.map((c) => {
                  const ts = TOOL_STATUS[c.status];
                  return (
                    <li key={c.id} className="flex flex-col gap-1 border-t border-edge-faint px-4 py-2.5 first:border-t-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusChip tone={ts.tone} dot label={ts.label} />
                        <span className="text-[13px] text-ink-primary">{c.label}</span>
                        {c.mandatory ? (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-accent-cyan">mandatory</span>
                        ) : (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">optional</span>
                        )}
                        {c.detail && <span className="ml-auto font-mono text-[10.5px] text-ink-faint">{c.detail}</span>}
                      </div>
                      {c.status !== "alive" && c.remediation && (
                        <p className="font-mono text-[11px] text-accent-amber">↳ {c.remediation}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
