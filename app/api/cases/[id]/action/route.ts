import { installAndDecompile, pushToDevice, uninstall, agentReport } from "@/lib/caseStatus";
import type { AgentStatus } from "@/lib/caseView";
import { caseQueue, METADATA_DISPATCH_GATE } from "@/lib/cases";
import { getCompiledMission } from "@/lib/gems/goldenMission";
import { evidenceReturn, artifactContent, extractedPayloads } from "@/lib/mock";
import { produceMission, produceEvidence } from "@/lib/bridge-fs";

// Human-in-the-loop case actions.
//   install_decompile → install APK + slice; arms the STATIC agent. On a
//     below-gate case this is a gate escalation (human override).
//   push_device → ensure the device filesystem is current over PixelBridge,
//     then flip the agent to DYNAMIC.
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const kase = caseQueue.find((c) => c.case_id === id);
    if (!kase) return Response.json({ error: `unknown case ${id}` }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      sliceOk?: boolean;
      run?: AgentStatus;
    };

    if (body.action === "install_decompile") {
      const belowGate = kase.metadata_score < METADATA_DISPATCH_GATE;
      const rt = await installAndDecompile(id, { belowGate, sliceOk: body.sliceOk });
      return Response.json(rt);
    }

    if (body.action === "uninstall") {
      return Response.json(await uninstall(id));
    }

    // The agent reports its own run-status (placeholder until the real agent plugs in).
    if (body.action === "agent_report") {
      const allowed: AgentStatus[] = ["static_running", "static_done", "dynamic_running", "dynamic_done"];
      if (!body.run || !allowed.includes(body.run)) {
        return Response.json({ error: `invalid run status ${body.run}` }, { status: 400 });
      }
      return Response.json(await agentReport(id, body.run));
    }

    if (body.action === "push_device") {
      // Ensure the device filesystem is up to date BEFORE flipping to dynamic.
      let detail = "device filesystem synchronized (signal-level case — no traced mission to materialize)";
      if (kase.traced && kase.mission_id) {
        const mission = getCompiledMission();
        await produceMission(mission);
        await produceEvidence(
          evidenceReturn,
          artifactContent,
          extractedPayloads.map((p) => ({ payloadStoragePath: p.storage_path })),
        );
        detail = `device filesystem synchronized via PixelBridge (mission ${mission.mission_id}, ${evidenceReturn.node_evidence.length} nodes materialized)`;
      }
      const rt = await pushToDevice(id, detail);
      return Response.json(rt);
    }

    return Response.json({ error: `unknown action ${body.action}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cases:${id}] action failed:`, message);
    return Response.json({ error: "action failed", message }, { status: 500 });
  }
}
