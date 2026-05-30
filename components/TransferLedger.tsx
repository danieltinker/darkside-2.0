"use client";

import { useEffect, useState } from "react";
import { StatusChip } from "./StatusChip";
import type { TransferLogEntry } from "@/lib/bridge-fs";

// Read-only view of this machine's transfer ledger — every bundle imported,
// with its unique transfer_id, package, completeness, and duplicate flag. Lets
// the operator confirm, per package, what arrived and what's complete.
export function TransferLedger() {
  const [log, setLog] = useState<TransferLogEntry[]>([]);

  useEffect(() => {
    fetch("/api/bridge/transfers", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setLog(d))
      .catch(() => {});
  }, []);

  if (!log.length) return null;

  return (
    <section className="mt-6">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
        Transfer ledger · {log.length} imported
      </p>
      <div className="overflow-x-auto rounded-xl border border-edge bg-bg-card/70">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-edge text-[11px] uppercase tracking-wider text-ink-faint">
              <th className="px-3 py-2 font-medium">Transfer</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Package</th>
              <th className="px-3 py-2 font-medium">Complete</th>
              <th className="px-3 py-2 font-medium">Checksum</th>
              <th className="px-3 py-2 font-medium">Carried</th>
            </tr>
          </thead>
          <tbody>
            {log.map((t, i) => (
              <tr key={`${t.transfer_id}-${i}`} className="border-t border-edge-faint align-middle">
                <td className="px-3 py-2 font-mono text-[11px] text-ink-secondary">
                  {t.transfer_id}
                  {t.duplicate && <span className="ml-2 text-accent-amber">· duplicate</span>}
                </td>
                <td className="px-3 py-2">
                  <StatusChip tone={t.kind === "mission" ? "cyan" : "violet"} label={t.kind} />
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-ink-muted">{t.package_name ?? "—"}</td>
                <td className="px-3 py-2">
                  <StatusChip tone={t.complete ? "green" : "amber"} dot label={t.complete ? "complete" : "partial"} />
                </td>
                <td className="px-3 py-2">
                  <StatusChip tone={t.checksum_ok ? "green" : "red"} label={t.checksum_ok ? "ok" : "mismatch"} />
                </td>
                <td className="px-3 py-2 font-mono text-[10.5px] text-ink-faint">{t.imported_at.replace("T", " ").slice(0, 19)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
