import { getState, type Role } from "@/lib/bridge-fs";
import { MISSION_ID } from "@/lib/mock";

// What a machine's dashboard renders — read straight off its own bridge disk.
// ?role=yoda|vader (&id=<mission_id>, defaults to the golden case).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const id = searchParams.get("id") ?? MISSION_ID;

  if (role !== "yoda" && role !== "vader") {
    return Response.json({ error: "role=yoda|vader required" }, { status: 400 });
  }

  try {
    const state = await getState(role as Role, id);
    return Response.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json({ error: String((err as Error).message) }, { status: 500 });
  }
}
