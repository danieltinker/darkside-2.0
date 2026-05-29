import { readArtifact } from "@/lib/bridge-fs";

// Serve a single real artifact file off this machine's bridge disk. The catch-all
// segments reconstruct the contract path, e.g.
//   /api/bridge/artifact/bridge/artifacts/m_8821/frida/n1_callback.log
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const contractPath = segments.join("/");

  try {
    const file = await readArtifact(contractPath);
    if (!file) return new Response("not found", { status: 404 });
    return new Response(new Uint8Array(file.buf), {
      headers: { "Content-Type": file.contentType, "Cache-Control": "no-store" },
    });
  } catch (err) {
    return Response.json({ error: String((err as Error).message) }, { status: 400 });
  }
}
