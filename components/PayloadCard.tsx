import type { ExtractedPayload } from "@/lib/contract";
import { StatusChip } from "./StatusChip";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function PayloadCard({ payload }: { payload: ExtractedPayload }) {
  return (
    <div className="rounded-xl border border-accent-red/30 bg-accent-red/[0.05] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusChip tone="red" dot label={`Extracted ${payload.type}`} />
          {payload.found_at_node && (
            <span className="font-mono text-[11px] text-ink-muted">
              found at {payload.found_at_node}
            </span>
          )}
        </div>
        <a
          href={payload.storage_path}
          download
          className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-1.5 font-mono text-[12px] font-medium text-accent-red transition-colors hover:bg-accent-red/20"
        >
          ↓ Download
        </a>
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-ink-secondary">{payload.description}</p>
      <dl className="mt-3 grid gap-1 font-mono text-[10.5px] text-ink-muted sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-ink-faint">sha256</dt>
          <dd className="break-all">{payload.sha256.slice(0, 24)}…</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-ink-faint">size</dt>
          <dd>{formatBytes(payload.size_bytes)}</dd>
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <dt className="w-20 shrink-0 text-ink-faint">on-device</dt>
          <dd className="break-all">{payload.source_path_on_device}</dd>
        </div>
      </dl>
    </div>
  );
}
