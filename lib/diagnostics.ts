import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

import { loadCategory, loadChains } from "./gems/loadGem";
import { getCompiledMission } from "./gems/goldenMission";
import { buildCaseRows } from "./caseRows";
import { evidenceReturn, artifactContent, extractedPayloads, MISSION_ID } from "./mock";
import {
  produceMission,
  produceEvidence,
  packMissionBundle,
  packEvidenceBundle,
  importBundle,
  getState,
  resetBridge,
  type MissionBundle,
  type EvidenceBundle,
} from "./bridge-fs";
import { reconcile } from "./reconcile";

// =====================================================================
// End-to-end diagnostics — the single source of truth for "what is running,
// step by step, and where did it break." Exercises the FULL flow exactly as
// production does: load gems → compile mission → reset bridge → produce/pack/
// import the mission bundle → produce/pack/import the evidence bundle → read
// state → reconcile → assert the golden score. Every step is timed and any
// throw is captured (never aborts the run), so a field operator can run this
// and send back one JSON report that tells us precisely what failed.
// =====================================================================

export type DiagStatus = "pass" | "fail" | "skip";

export type DiagStep = {
  id: string;
  label: string;
  status: DiagStatus;
  ms: number;
  detail?: Record<string, unknown>;
  error?: string;
};

export type DiagReport = {
  ok: boolean;
  startedAt: string;
  durationMs: number;
  env: { node: string; platform: string; cwd: string; appVersion: string };
  summary: { total: number; passed: number; failed: number; skipped: number };
  steps: DiagStep[];
};

type StepResult<T> = { value: T; detail?: Record<string, unknown> };

function appVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "unknown";
  }
}

export async function runDiagnostics(): Promise<DiagReport> {
  const started = Date.now();
  const steps: DiagStep[] = [];

  // Run a step, time it, capture any throw (never re-thrown). `critical:true`
  // short-circuits later steps that depend on this one (marks them skipped).
  let aborted = false;
  async function step<T>(
    id: string,
    label: string,
    fn: () => Promise<StepResult<T>> | StepResult<T>,
    opts: { critical?: boolean } = {},
  ): Promise<T | null> {
    if (aborted) {
      steps.push({ id, label, status: "skip", ms: 0 });
      return null;
    }
    const t0 = Date.now();
    try {
      const { value, detail } = await fn();
      steps.push({ id, label, status: "pass", ms: Date.now() - t0, detail });
      return value;
    } catch (err) {
      steps.push({ id, label, status: "fail", ms: Date.now() - t0, error: (err as Error).message });
      if (opts.critical) aborted = true;
      return null;
    }
  }

  // 1. Gem layer loads + validates (zod) — category, every rubric's chains.
  await step("gems.category", "Load + validate riskware category gem", () => {
    const cat = loadCategory("riskware");
    return { value: cat, detail: { rubrics: cat.rubrics.length, metadata_gate: cat.dispatch_gate.metadata_score_gte } };
  }, { critical: true });

  await step("gems.chains", "Load + validate every registered rubric's chains.yaml", () => {
    const cat = loadCategory("riskware");
    const perRubric = cat.rubrics.map((r) => ({ rubric: r.rubric_id, chains: loadChains(r.rubric_id).chains.length }));
    const total = perRubric.reduce((s, r) => s + r.chains, 0);
    return { value: total, detail: { rubrics: perRubric.length, totalChains: total, perRubric } };
  }, { critical: true });

  // 2. Compile the golden mission from the gem graph (validates graph.yaml).
  const mission = await step("mission.compile", "Compile golden MissionContext from gem graph", () => {
    const m = getCompiledMission();
    return {
      value: m,
      detail: { mission_id: m.mission_id, nodes: m.flow.nodes.length, required: m.flow.required_nodes.length, chain: m.rubric.chain_id },
    };
  }, { critical: true });

  // 3. Case queue joins + scores without drift.
  await step("queue.rows", "Build case queue rows (roster × chains, no drift)", () => {
    const rows = buildCaseRows();
    return { value: rows, detail: { cases: rows.length, scored: rows.filter((r) => r.status === "scored").length } };
  });

  // 4. Reset this machine's bridge to a clean state.
  await step("bridge.reset", "Reset bridge/ mailboxes", async () => {
    await resetBridge();
    return { value: true };
  }, { critical: true });

  // 5–7. Yoda side: produce → pack → import the mission bundle.
  await step("bridge.produceMission", "Yoda: write MissionContext to outbox", async () => {
    if (!mission) throw new Error("no compiled mission");
    await produceMission(mission);
    return { value: true };
  }, { critical: true });

  const missionBundle = await step<MissionBundle>("bridge.packMission", "Pack mission bundle (carry artifact)", async () => {
    const b = await packMissionBundle(MISSION_ID);
    if (!b) throw new Error("packMissionBundle returned null");
    return { value: b, detail: { checksum: b.mission.checksum.slice(0, 16) } };
  }, { critical: true });

  await step("bridge.importMission", "Vader: import mission bundle (verify checksum)", async () => {
    if (!missionBundle) throw new Error("no mission bundle");
    const r = await importBundle(missionBundle);
    if (!r.checksum_ok) throw new Error("mission checksum mismatch on import");
    return { value: r, detail: { checksum_ok: r.checksum_ok, artifacts: r.artifacts_written } };
  }, { critical: true });

  // 8–11. Vader side: produce evidence + artifacts → pack → import back.
  await step("bridge.produceEvidence", "Vader: write EvidenceReturn + artifacts to outbox", async () => {
    await produceEvidence(
      evidenceReturn,
      artifactContent,
      extractedPayloads.map((p) => ({ payloadStoragePath: p.storage_path })),
    );
    return { value: true, detail: { node_evidence: evidenceReturn.node_evidence.length } };
  }, { critical: true });

  const evidenceBundle = await step<EvidenceBundle>("bridge.packEvidence", "Pack evidence bundle (carry artifact)", async () => {
    const b = await packEvidenceBundle(MISSION_ID);
    if (!b) throw new Error("packEvidenceBundle returned null");
    return { value: b, detail: { checksum: b.evidence.checksum.slice(0, 16), artifacts: b.artifacts.length } };
  }, { critical: true });

  await step("bridge.importEvidence", "Yoda: import evidence bundle (verify artifacts)", async () => {
    if (!evidenceBundle) throw new Error("no evidence bundle");
    const r = await importBundle(evidenceBundle);
    if (!r.checksum_ok) throw new Error("evidence checksum mismatch on import");
    if (r.artifacts_written !== r.artifacts_verified) {
      throw new Error(`artifact verify mismatch: ${r.artifacts_verified}/${r.artifacts_written}`);
    }
    return { value: r, detail: { artifacts_written: r.artifacts_written, artifacts_verified: r.artifacts_verified } };
  }, { critical: true });

  // 12. State readable after the round-trip.
  await step("bridge.state", "Read reconciled bridge state (yoda inbox)", async () => {
    const s = await getState("yoda", MISSION_ID);
    return { value: s, detail: { hasMission: !!s.mission, hasEvidence: !!s.evidence } };
  });

  // 13–14. Reconcile + assert the golden score.
  await step("score.reconcile", "Reconcile mission + evidence → golden score is strong 8", async () => {
    if (!mission) throw new Error("no compiled mission");
    const s = await getState("yoda", MISSION_ID);
    if (!s.evidence) throw new Error("evidence not present after round-trip");
    const recon = reconcile(mission, s.evidence);
    if (recon.score !== 8) throw new Error(`expected score 8, got ${recon.score}`);
    if (recon.effectiveVerdict !== "confirmed_tp") throw new Error(`expected confirmed_tp, got ${recon.effectiveVerdict}`);
    return {
      value: recon.score,
      detail: {
        score: recon.score,
        verdict: recon.effectiveVerdict,
        requiredConfirmed: `${recon.requiredConfirmedCount}/${recon.requiredNodes.length}`,
      },
    };
  });

  const passed = steps.filter((s) => s.status === "pass").length;
  const failed = steps.filter((s) => s.status === "fail").length;
  const skipped = steps.filter((s) => s.status === "skip").length;

  return {
    ok: failed === 0 && skipped === 0,
    startedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started,
    env: { node: process.version, platform: process.platform, cwd: process.cwd(), appVersion: appVersion() },
    summary: { total: steps.length, passed, failed, skipped },
    steps,
  };
}
