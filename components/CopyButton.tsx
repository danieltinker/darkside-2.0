"use client";

import { useState } from "react";

// Small copy-to-clipboard control. Used wherever a reviewer needs to grab a
// value verbatim (file paths, Frida hook scripts) without retyping.
export function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation(); // never trigger a parent row/card click
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable (e.g. insecure context) — no-op */
        }
      }}
      title={`Copy${label ? ` ${label}` : ""}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded border border-edge px-1.5 py-0.5 font-mono text-[10px] transition-colors hover:border-edge-strong ${
        copied ? "border-accent-green/40 text-accent-green" : "text-ink-faint hover:text-ink-secondary"
      } ${className ?? ""}`}
    >
      {copied ? "✓ copied" : (label ?? "⧉ copy")}
    </button>
  );
}
