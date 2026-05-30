import Link from "next/link";
import { caseIdentity, missionContext } from "@/lib/mock";
import { TopNav } from "@/components/TopNav";
import { StatusChip } from "@/components/StatusChip";

function MachineCard({
  href,
  side,
  tone,
  title,
  role,
  bullets,
}: {
  href: string;
  side: string;
  tone: "yoda" | "vader";
  title: string;
  role: string;
  bullets: string[];
}) {
  const accent = tone === "yoda" ? "text-yoda" : "text-vader";
  const ring = tone === "yoda" ? "hover:border-yoda/50" : "hover:border-vader/50";
  return (
    <Link
      href={href}
      className={`group flex flex-1 flex-col rounded-xl border border-edge bg-bg-card/80 p-5 transition-colors ${ring}`}
    >
      <div className="flex items-center justify-between">
        <span className={`font-mono text-[11px] uppercase tracking-[0.25em] ${accent}`}>{side}</span>
        <span className="font-mono text-[12px] text-ink-faint transition-transform group-hover:translate-x-0.5">
          open →
        </span>
      </div>
      <h3 className="mt-2 text-lg font-semibold text-ink-primary">{title}</h3>
      <p className="mt-0.5 text-[12.5px] text-ink-secondary">{role}</p>
      <ul className="mt-3 space-y-1 text-[12px] text-ink-muted">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${tone === "yoda" ? "bg-yoda" : "bg-vader"}`} />
            {b}
          </li>
        ))}
      </ul>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <TopNav active="home" />
      <main className="w-full px-6 lg:px-10 py-10">
        <div className="max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent-green">
            MMP uncloaking · one IOC, end-to-end
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary">
            Prove the cloaked affiliate chain across two machines.
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
            The true affiliate URL never appears in static strings. It is built
            at runtime from a tracker response and loaded into a WebView through
            coroutine + native indirection. Yoda confirms the static chain and
            ships a mission over PixelBridge; Darth Vader runs it and attaches
            per-node evidence. A fully confirmed chain scores{" "}
            <span className="font-mono text-accent-green">strong = 8</span>.
          </p>
        </div>

        {/* The case */}
        <div className="mt-8 rounded-xl border border-edge bg-bg-panel/70 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                Active case
              </span>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="font-mono text-[15px] font-semibold text-ink-primary">
                  {caseIdentity.package_name}
                </span>
                <span className="font-mono text-[11px] text-ink-muted">
                  v{caseIdentity.version_name} · {caseIdentity.developer}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusChip tone="neutral" label={caseIdentity.top_countries.join(" · ")} />
              <StatusChip tone="neutral" dot label={missionContext.queue_lock.lock_id} />
              <StatusChip tone="green" label="MMP Cloaking · Strong 8" />
            </div>
          </div>
        </div>

        {/* Pipeline */}
        <div className="mt-8 flex flex-col items-stretch gap-3 md:flex-row md:items-center">
          <MachineCard
            href="/yoda"
            side="Yoda"
            tone="yoda"
            title="Static / mission control"
            role="Owns identity, the static call graph, and final scoring."
            bullets={[
              "Confirm the 3 static stages (one call graph)",
              "Attach decryptors + recovered cleartext",
              "Send mission → PixelBridge",
              "Reconcile returned evidence → strong 8",
            ]}
          />
          <div className="flex flex-row items-center justify-center gap-2 md:flex-col">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              PixelBridge
            </span>
            <span className="font-mono text-accent-cyan">⇄</span>
            <span className="font-mono text-[10px] text-ink-faint">contract</span>
          </div>
          <MachineCard
            href="/vader"
            side="Darth Vader"
            tone="vader"
            title="Dynamic lab"
            role="Owns runtime confirmation and evidence capture."
            bullets={[
              "Re-confirm static signatures locally",
              "Run the app, hook with Frida",
              "Attach frida / http / screenshot per node",
              "Confirm native path + send evidence back",
            ]}
          />
        </div>
      </main>
    </div>
  );
}
