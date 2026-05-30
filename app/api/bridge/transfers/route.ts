import { getTransfers } from "@/lib/bridge-fs";

// The transfer ledger for this machine — every bundle imported, with its unique
// transfer_id, package, completeness, and whether it was a duplicate carry.
// Lets Yoda see, per package, what's arrived and what's complete.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getTransfers());
  } catch (err) {
    return Response.json({ error: String((err as Error).message) }, { status: 500 });
  }
}
