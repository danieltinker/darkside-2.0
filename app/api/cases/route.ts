import { readAllRuntime } from "@/lib/caseStatus";

// All case runtime overlays (agent status, install/slice/device state, events).
// The Queue and Agent tab poll this to reflect the live human-in-the-loop flow.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await readAllRuntime());
}
