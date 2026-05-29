import { packMissionBundle, packEvidenceBundle } from "@/lib/bridge-fs";

// Download the single self-contained bundle file the operator carries on the
// device across the airgap. ?kind=mission|evidence & ?id=<mission_id>.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const id = searchParams.get("id");

  if (!id || (kind !== "mission" && kind !== "evidence")) {
    return Response.json({ error: "kind=mission|evidence and id required" }, { status: 400 });
  }

  try {
    const bundle =
      kind === "mission" ? await packMissionBundle(id) : await packEvidenceBundle(id);
    if (!bundle) {
      return Response.json(
        { error: `no ${kind} found for ${id} — produce it first` },
        { status: 404 },
      );
    }
    const filename = `darkbridge-${kind}-${id}.json`;
    return new Response(JSON.stringify(bundle, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return Response.json({ error: String((err as Error).message) }, { status: 500 });
  }
}
