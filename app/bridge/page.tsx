"use client";

import { ensureSeeded } from "@/lib/seed";
import { TopNav } from "@/components/TopNav";
import { BridgeExplorer } from "@/components/BridgeExplorer";

// Seed the known-URL DB once when the bundle is first evaluated.
ensureSeeded();

export default function BridgePage() {
  return (
    <div className="min-h-screen">
      <TopNav active="bridge" />
      <main className="mx-auto max-w-6xl px-5 py-6">
        <div className="mb-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent-cyan">
            PixelBridge · filesystem
          </p>
          <h1 className="mt-1 text-xl font-semibold text-ink-primary">
            Device & bridge layout — where the evidence lives
          </h1>
          <p className="mt-1 max-w-3xl text-[13px] text-ink-secondary">
            The expected on-disk structure across both machines. Yoda&apos;s decompiled
            sources hold the <span className="text-yoda">static evidence</span>; Vader&apos;s
            device runtime is the source of the <span className="text-vader">dynamic evidence</span>;
            the two are exchanged as typed messages and artifacts over the shared{" "}
            <span className="text-accent-cyan">PixelBridge</span>. Select any file to extract
            what it carries.
          </p>
        </div>
        <BridgeExplorer />
      </main>
    </div>
  );
}
