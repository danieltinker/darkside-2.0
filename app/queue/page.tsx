import { TopNav } from "@/components/TopNav";
import { CaseQueue } from "@/components/CaseQueue";
import { buildCaseRows } from "@/lib/caseRows";

// Server component: join the roster with the source-of-truth chain metadata,
// then hand serializable rows to the client table.
export default function QueuePage() {
  const rows = buildCaseRows();
  const scored = rows.filter((r) => r.status === "scored").length;
  const running = rows.filter((r) => r.status === "running").length;
  const locked = rows.filter((r) => r.status === "locked").length;

  return (
    <div className="min-h-screen">
      <TopNav active="queue" />
      <main className="w-full px-6 lg:px-10 py-10">
        <div className="max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent-green">
            Case queue · riskware
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary">
            Active cases across rubrics.
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
            Each locked case routes to a rubric; Yoda confirms which chains fire and
            the score is the <span className="font-mono text-accent-green">binary-per-chain</span>{" "}
            sum of confirmed signals. One case is fully traced end-to-end (the golden MMP
            case); the rest are signal-level. Click a row to see its chain breakdown.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Stat label="cases" value={rows.length} />
          <Stat label="scored TP" value={scored} tone="text-accent-green" />
          <Stat label="running" value={running} tone="text-accent-cyan" />
          <Stat label="locked" value={locked} tone="text-ink-secondary" />
        </div>

        <div className="mt-6">
          <CaseQueue rows={rows} />
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, tone = "text-ink-primary" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-edge bg-bg-card/70 px-4 py-2">
      <div className={`font-mono text-xl font-semibold ${tone}`}>{value}</div>
      <div className="font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">{label}</div>
    </div>
  );
}
