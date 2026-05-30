import { runPreflight } from "@/lib/preflight";

// Dynamic-research preflight: probes the on-host tools + device. Runs on the
// Vader machine (server === host). Always 200 — "not ready" is a normal
// operational state, not a server error; consumers gate on the `ok` field
// (the CLI uses it for its exit code). Only a harness crash is a 500.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await runPreflight();
    return Response.json(report, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[preflight] harness crash:", message);
    return Response.json({ ok: false, error: "preflight harness crashed", message }, { status: 500 });
  }
}
