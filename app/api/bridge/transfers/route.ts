import { getTransfers, markMissionDone } from "@/lib/bridge-fs";

// The transfer ledger for this machine — every bundle imported, with its unique
// transfer_id, package, version, completeness, and whether it was a duplicate
// carry. GET = list; POST {mission_id, done?} = mark a mission's investigation done.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getTransfers());
  } catch (err) {
    return Response.json({ error: String((err as Error).message) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { mission_id, done } = (await request.json().catch(() => ({}))) as {
      mission_id?: string;
      done?: boolean;
    };
    if (!mission_id) return Response.json({ error: "mission_id required" }, { status: 400 });
    const updated = await markMissionDone(mission_id, done ?? true);
    return Response.json({ ok: true, mission_id, updated });
  } catch (err) {
    return Response.json({ error: String((err as Error).message) }, { status: 500 });
  }
}
