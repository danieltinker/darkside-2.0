import { TopNav } from "@/components/TopNav";
import { AgentBoard } from "@/components/AgentBoard";
import { buildCaseRows } from "@/lib/caseRows";

// Server component: build rows (with scores from the gem chains) → client board.
export default function AgentPage() {
  const rows = buildCaseRows();
  return (
    <div className="min-h-screen">
      <TopNav active="agent" />
      <main className="w-full px-6 lg:px-10 py-10">
        <div className="max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent-green">
            Analysis agents · human-in-the-loop
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary">Active agents.</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
            Install &amp; Decompile arms the agent (<span className="text-accent-amber">waiting for dispatch</span>). You
            dispatch it <span className="text-ink-primary">manually</span> per its gem; it reports{" "}
            <span className="text-accent-cyan">running</span> →{" "}
            <span className="text-accent-green">done static</span> (the score is its output). Pushing to the device runs
            the <span className="text-accent-violet">dynamic</span> investigation on Vader. The controls below stand in
            for those agent status reports until the real agent is plugged in.
          </p>
        </div>
        <AgentBoard rows={rows} />
      </main>
    </div>
  );
}
