"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import type { CaseRow, ChainOutcome } from "@/lib/caseRows";
import type { QueueStatus } from "@/lib/cases";
import { StatusChip, type ChipTone } from "./StatusChip";

const STATUS_TONE: Record<QueueStatus, ChipTone> = {
  scored: "green",
  partial: "amber",
  fp: "red",
  running: "cyan",
  locked: "neutral",
};

const STATUS_LABEL: Record<QueueStatus, string> = {
  scored: "Scored TP",
  partial: "Partial",
  fp: "Failed FP",
  running: "Running",
  locked: "Locked",
};

const STRENGTH_TONE: Record<ChainOutcome["strength"], ChipTone> = {
  strong: "red",
  medium: "amber",
  weak: "cyan",
  non_signal: "neutral",
};

// score is meaningful only once an investigation has produced a verdict.
function scoreDisplay(row: CaseRow): string {
  if (row.status === "running" || row.status === "locked") return "—";
  return String(row.score);
}

function ChainChecklist({ chains }: { chains: ChainOutcome[] }) {
  return (
    <ul className="space-y-1">
      {chains.map((c) => (
        <li
          key={c.chain_id}
          className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${
            c.confirmed ? "border-accent-green/30 bg-accent-green/[0.05]" : "border-edge bg-bg-void/40"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.confirmed ? "bg-accent-green" : "bg-ink-faint"}`}
            aria-hidden
          />
          <span className={`flex-1 text-[12px] ${c.confirmed ? "text-ink-primary" : "text-ink-muted"}`}>
            {c.name}
          </span>
          <StatusChip tone={STRENGTH_TONE[c.strength]} label={`${c.strength} · ${c.points}`} />
          <span className={`w-10 text-right font-mono text-[12px] ${c.confirmed ? "text-accent-green" : "text-ink-faint"}`}>
            {c.confirmed ? `+${c.points}` : "0"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CaseQueue({ rows }: { rows: CaseRow[] }) {
  const [statusFilter, setStatusFilter] = useState<QueueStatus | "all">("all");
  const [rubricFilter, setRubricFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rubrics = useMemo(
    () => Array.from(new Set(rows.map((r) => r.rubric_name))).sort(),
    [rows],
  );

  const filtered = rows.filter(
    (r) =>
      (statusFilter === "all" || r.status === statusFilter) &&
      (rubricFilter === "all" || r.rubric_name === rubricFilter),
  );

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">filter</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as QueueStatus | "all")}
          className="rounded-md border border-edge bg-bg-raised px-2 py-1 font-mono text-[12px] text-ink-secondary"
        >
          <option value="all">all statuses</option>
          {(Object.keys(STATUS_LABEL) as QueueStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={rubricFilter}
          onChange={(e) => setRubricFilter(e.target.value)}
          className="rounded-md border border-edge bg-bg-raised px-2 py-1 font-mono text-[12px] text-ink-secondary"
        >
          <option value="all">all rubrics</option>
          {rubrics.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <span className="ml-auto font-mono text-[11px] text-ink-faint">
          {filtered.length} / {rows.length} cases
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-edge bg-bg-card/70">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-edge text-[11px] uppercase tracking-wider text-ink-faint">
              <th className="px-3 py-2 font-medium">Package</th>
              <th className="px-3 py-2 font-medium">Rubric</th>
              <th className="px-3 py-2 font-medium">Geo</th>
              <th className="px-3 py-2 font-medium text-center">Meta</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Score</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const isOpen = expanded === row.case_id;
              return (
                <Fragment key={row.case_id}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : row.case_id)}
                    className="cursor-pointer border-t border-edge-faint align-middle hover:bg-bg-raised/50"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12.5px] text-ink-primary">
                          {row.identity.package_name}
                        </span>
                        {row.traced && <StatusChip tone="violet" label="traced" title="Full flow graph + dynamic evidence" />}
                      </div>
                      <div className="font-mono text-[10.5px] text-ink-faint">
                        v{row.identity.version_name} · {row.identity.developer}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-ink-secondary">{row.rubric_name}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-ink-muted">
                      {row.identity.top_countries.join(" · ")}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-[12px] text-ink-secondary">
                      {row.metadata_score}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip
                        tone={STATUS_TONE[row.status]}
                        dot
                        pulse={row.status === "running"}
                        label={STATUS_LABEL[row.status]}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={`font-mono text-[15px] font-semibold ${
                          row.status === "scored"
                            ? "text-accent-green"
                            : row.status === "partial"
                              ? "text-accent-amber"
                              : row.status === "fp"
                                ? "text-accent-red"
                                : "text-ink-faint"
                        }`}
                      >
                        {scoreDisplay(row)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-ink-faint">
                      {isOpen ? "▾" : "▸"}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-edge-faint bg-bg-void/30">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="space-y-3">
                          {row.note && (
                            <p className="text-[12px] italic leading-snug text-ink-secondary">{row.note}</p>
                          )}
                          <div>
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                                Chains · binary per chain
                              </span>
                              <span className="font-mono text-[11px] text-ink-muted">
                                score {scoreDisplay(row)} · {row.chains.filter((c) => c.confirmed).length}/
                                {row.chains.length} confirmed
                              </span>
                            </div>
                            <ChainChecklist chains={row.chains} />
                          </div>
                          {row.traced && (
                            <div className="flex gap-2">
                              <Link
                                href="/yoda"
                                className="rounded-md border border-yoda/40 bg-yoda/10 px-3 py-1.5 text-[12px] font-medium text-yoda hover:border-yoda/60"
                              >
                                Yoda · static →
                              </Link>
                              <Link
                                href="/vader"
                                className="rounded-md border border-vader/40 bg-vader/10 px-3 py-1.5 text-[12px] font-medium text-vader hover:border-vader/60"
                              >
                                Vader · dynamic →
                              </Link>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
