import { resetBridge } from "@/lib/bridge-fs";

// Wipe this machine's bridge/ directory — demo / operator reset.
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await resetBridge();
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String((err as Error).message) }, { status: 500 });
  }
}
