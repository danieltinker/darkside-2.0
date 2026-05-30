"use client";

import { useEffect } from "react";
import { useState } from "react";
import { CopyButton } from "./CopyButton";

// A "view hook" button that opens a modal showing the Frida hook script for a
// node, so a reviewer can read and copy the exact instrumentation to confirm
// it manually. Closes on backdrop click or Esc.
export function HookDialog({
  title,
  subtitle,
  code,
}: {
  title: string;
  subtitle?: string;
  code: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="View the Frida hook script for manual review"
        className="inline-flex shrink-0 items-center gap-1 rounded border border-vader/40 bg-vader/10 px-1.5 py-0.5 font-mono text-[10px] text-vader transition-colors hover:bg-vader/20"
      >
        ⌗ view hook
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg-void/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-edge bg-bg-card shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-edge px-4 py-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-vader">
                  Frida hook · manual review
                </p>
                <h3 className="truncate font-mono text-[13px] font-semibold text-ink-primary">{title}</h3>
                {subtitle && <p className="truncate font-mono text-[10.5px] text-ink-faint">{subtitle}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <CopyButton text={code} label="⧉ copy script" />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded border border-edge px-2 py-0.5 font-mono text-[11px] text-ink-muted hover:text-ink-secondary"
                >
                  ✕ close
                </button>
              </div>
            </div>
            <pre className="overflow-auto bg-bg-void/80 p-4 font-mono text-[11.5px] leading-relaxed text-ink-secondary">
              {code}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
