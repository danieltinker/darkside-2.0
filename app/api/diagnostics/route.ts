import { runDiagnostics } from "@/lib/diagnostics";

// Full end-to-end self-check. Returns a structured step-by-step report;
// 200 when everything passes, 500 when any step failed/skipped, so both
// the in-app button and the `npm run diagnose` CLI can branch on the status.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await runDiagnostics();
    if (!report.ok) {
      const failed = report.steps.filter((s) => s.status !== "pass").map((s) => s.id);
      console.error("[diagnostics] run failed:", failed.join(", "));
    }
    return Response.json(report, { status: report.ok ? 200 : 500 });
  } catch (err) {
    // runDiagnostics catches per-step errors itself; this guards an
    // unexpected harness-level crash so the field still gets a usable payload.
    const message = err instanceof Error ? err.message : String(err);
    console.error("[diagnostics] harness crash:", message);
    return Response.json(
      { ok: false, error: "diagnostics harness crashed", message, env: { node: process.version, platform: process.platform } },
      { status: 500 },
    );
  }
}
