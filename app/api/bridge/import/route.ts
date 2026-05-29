import { importBundle, type AnyBundle } from "@/lib/bridge-fs";

// Import a carried bundle into THIS machine's inbox. Accepts either a raw JSON
// body (the bundle object) or a multipart file upload under field "bundle".
// This is the only path data reaches a machine across the airgap.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let bundle: AnyBundle;
    const ct = request.headers.get("content-type") ?? "";

    if (ct.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("bundle");
      if (!(file instanceof File)) {
        return Response.json({ error: "missing 'bundle' file field" }, { status: 400 });
      }
      bundle = JSON.parse(await file.text()) as AnyBundle;
    } else {
      bundle = (await request.json()) as AnyBundle;
    }

    const result = await importBundle(bundle);
    return Response.json(result, { status: result.ok ? 200 : 422 });
  } catch (err) {
    return Response.json({ error: String((err as Error).message) }, { status: 400 });
  }
}
