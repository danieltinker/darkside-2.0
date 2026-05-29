"use client";

import type { ReactNode } from "react";
import { useFilePicker, type ImportResultDTO } from "@/lib/session";

// The airgap transport controls. Export writes a single bundle file the
// operator carries on the device; Import pulls a carried bundle into this
// machine's inbox. Nothing else crosses the boundary.

export function ExportButton({
  label,
  onExport,
  hint,
  tone = "cyan",
}: {
  label: string;
  onExport: () => void;
  hint?: string;
  tone?: "cyan" | "yoda" | "vader";
}) {
  const ring =
    tone === "yoda"
      ? "border-yoda/50 bg-yoda/15 text-yoda hover:bg-yoda/25"
      : tone === "vader"
        ? "border-vader/50 bg-vader/15 text-vader hover:bg-vader/25"
        : "border-accent-cyan/50 bg-accent-cyan/15 text-accent-cyan hover:bg-accent-cyan/25";
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onExport}
        className={`rounded-lg border px-5 py-2.5 font-mono text-[13px] font-semibold transition-colors ${ring}`}
      >
        {label}
      </button>
      {hint && <span className="font-mono text-[10.5px] text-ink-faint">{hint}</span>}
    </div>
  );
}

export function ImportButton({
  label,
  onFile,
  hint,
}: {
  label: string;
  onFile: (f: File) => void;
  hint?: string;
}) {
  const picker = useFilePicker(onFile);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={picker.open}
        className="rounded-lg border border-edge-strong bg-bg-raised px-5 py-2.5 font-mono text-[13px] font-semibold text-ink-secondary transition-colors hover:border-accent-cyan/50 hover:text-ink-primary"
      >
        {label}
      </button>
      {hint && <span className="font-mono text-[10.5px] text-ink-faint">{hint}</span>}
      <input
        ref={picker.ref}
        type="file"
        accept="application/json,.json"
        onChange={picker.onChange}
        className="hidden"
      />
    </div>
  );
}

export function DevicePanel({
  title,
  subtitle,
  children,
  note,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  note?: string | null;
}) {
  return (
    <div className="mb-5 rounded-xl border border-edge bg-bg-card/60 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-accent-cyan">⇄</span>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-muted">{title}</p>
      </div>
      {subtitle && <p className="mb-3 max-w-2xl text-[12.5px] text-ink-secondary">{subtitle}</p>}
      <div className="flex flex-wrap items-end gap-4">{children}</div>
      {note && (
        <p className="mt-3 font-mono text-[11px] text-accent-green">{note}</p>
      )}
    </div>
  );
}

export function ImportReceipt({ result }: { result: ImportResultDTO | null }) {
  if (!result) return null;
  return (
    <div
      className={`mt-3 rounded-lg border p-3 font-mono text-[11px] ${
        result.ok
          ? "border-accent-green/40 bg-accent-green/5 text-accent-green"
          : "border-accent-red/40 bg-accent-red/5 text-accent-red"
      }`}
    >
      <div>
        {result.ok ? "✓" : "✗"} imported {result.kind} · {result.mission_id} · checksum{" "}
        {result.checksum_ok ? "ok" : "MISMATCH"}
        {result.kind === "evidence" &&
          ` · ${result.artifacts_verified}/${result.artifacts_written} artifacts verified`}
      </div>
      {result.errors.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-ink-muted">
          {result.errors.map((e, i) => (
            <li key={i}>– {e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
