"use client";

import { useState } from "react";
import { StatusChip } from "./StatusChip";
import { CopyButton } from "./CopyButton";
import type { PreflightReport, ToolStatus } from "@/lib/preflight";

const TONE: Record<ToolStatus, "green" | "red" | "amber"> = { alive: "green", dead: "red", unknown: "amber" };
const LABEL: Record<ToolStatus, string> = { alive: "alive", dead: "down", unknown: "confirm" };

export function DeviceSystemHealth() {
  const [report, setReport] = useState<PreflightReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/preflight", { headers: { accept: "application/json" }, cache: "no-store" });
      setReport((await res.json()) as PreflightReport);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const checkById = (id: string) => report?.checks.find((c) => c.id === id);
  const nord = checkById("vpn.nordvpn");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={busy}
          className="rounded-lg border border-vader/50 bg-vader/15 px-5 py-2.5 font-mono text-[13px] font-semibold text-vader transition-colors hover:bg-vader/25 disabled:opacity-50"
        >
          {busy ? "Probing…" : "▶ Check device system health"}
        </button>
        {report && <CopyButton text={JSON.stringify(report, null, 2)} label="⧉ copy report JSON" />}
        {nord?.country && (
          <span className="ml-auto rounded-md border border-accent-green/35 bg-accent-green/10 px-2.5 py-1 font-mono text-[12px] text-accent-green">
            NordVPN · {nord.country}
          </span>
        )}
      </div>

      {err && (
        <p className="rounded-lg border border-accent-red/40 bg-accent-red/10 px-4 py-3 font-mono text-[12px] text-accent-red">{err}</p>
      )}

      {report && (
        <>
          {/* ---- Readiness gates ---- */}
          <div className="grid gap-3 sm:grid-cols-2">
            {report.gates.map((g) => (
              <div
                key={g.id}
                className={`rounded-xl border p-4 ${g.ready ? "border-accent-green/40 bg-accent-green/[0.05]" : "border-accent-red/35 bg-accent-red/[0.04]"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink-primary">{g.label}</span>
                  <StatusChip tone={g.ready ? "green" : "red"} dot label={g.ready ? "ALL SYSTEMS GO" : "NOT READY"} />
                </div>
                <p className="mt-0.5 text-[11.5px] text-ink-muted">{g.description}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {g.requires.map((reqId) => {
                    const c = checkById(reqId);
                    const ok = c?.status === "alive";
                    return (
                      <StatusChip
                        key={reqId}
                        tone={ok ? "green" : c?.status === "unknown" ? "amber" : "red"}
                        dot
                        label={c?.label ?? reqId}
                        title={c?.detail}
                      />
                    );
                  })}
                </div>
                {!g.ready && (
                  <p className="mt-2 font-mono text-[11px] text-accent-red">
                    blocked on: {g.blocking.map((b) => checkById(b)?.label ?? b).join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* ---- Individual tool checks ---- */}
          <ul className="overflow-hidden rounded-xl border border-edge bg-bg-card/70">
            {report.checks.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 border-t border-edge-faint px-4 py-2.5 first:border-t-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone={TONE[c.status]} dot label={LABEL[c.status]} />
                  <span className="text-[13px] text-ink-primary">{c.label}</span>
                  {c.country && <span className="font-mono text-[11px] text-accent-green">📍 {c.country}</span>}
                  {c.detail && <span className="ml-auto font-mono text-[10.5px] text-ink-faint">{c.detail}</span>}
                </div>
                {c.status !== "alive" && c.remediation && (
                  <p className="font-mono text-[11px] text-accent-amber">↳ {c.remediation}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
