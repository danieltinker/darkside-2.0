import type { ReactNode } from "react";

export type ChipTone = "green" | "red" | "amber" | "violet" | "cyan" | "neutral";

const TONE: Record<ChipTone, string> = {
  green: "border-accent-green/35 bg-accent-green/10 text-accent-green",
  red: "border-accent-red/35 bg-accent-red/10 text-accent-red",
  amber: "border-accent-amber/35 bg-accent-amber/10 text-accent-amber",
  violet: "border-accent-violet/35 bg-accent-violet/10 text-accent-violet",
  cyan: "border-accent-cyan/35 bg-accent-cyan/10 text-accent-cyan",
  neutral: "border-edge-strong bg-bg-raised text-ink-secondary",
};

const DOT: Record<ChipTone, string> = {
  green: "bg-accent-green",
  red: "bg-accent-red",
  amber: "bg-accent-amber",
  violet: "bg-accent-violet",
  cyan: "bg-accent-cyan",
  neutral: "bg-ink-muted",
};

export function StatusChip({
  label,
  tone = "neutral",
  dot = false,
  pulse = false,
  title,
  icon,
}: {
  label: ReactNode;
  tone?: ChipTone;
  dot?: boolean;
  pulse?: boolean;
  title?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider ${TONE[tone]}`}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${DOT[tone]}`}
            />
          )}
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
        </span>
      )}
      {icon}
      {label}
    </span>
  );
}

// Convenience mapping for the per-node effective status.
export function DynamicStatusChip({ status }: { status: "confirmed" | "failed" | "pending" }) {
  if (status === "confirmed")
    return <StatusChip tone="green" dot label="Confirmed" />;
  if (status === "failed") return <StatusChip tone="red" dot label="Failed" />;
  return <StatusChip tone="amber" dot pulse label="Pending" />;
}
