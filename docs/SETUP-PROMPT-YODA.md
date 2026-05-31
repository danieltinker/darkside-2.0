# Yoda machine — production setup prompt

> Give this file to an engineer or a coding agent on the **Yoda** machine. It maps
> every mocked seam to the real service to plug in. **The contract is law:** the
> shapes in `lib/contract.ts` and the bundle format in `lib/bridge-fs.ts` must not
> change — the two machines interoperate only through them. Keep `npm test` green
> (the gem-integrity + scoring guards) as you go.

## Role
Yoda is **static analysis / mission control**: intake apps → route by metadata gate →
decompile ("slice") → dispatch Sky Walker (static research) → confirm the chain →
compile a **MissionContext** → ship it over PixelBridge to Vader → reconcile the returned
**EvidenceReturn** into a score.

Run pinned to this role: `.env` has `DARKSIDE_ROLE=yoda` (nav is locked to Queue/Agent/
Yoda/Bridge/Diagnostics). Localhost: `npm ci && npm run build && npm start`.

## What is mocked today → what to plug in

1. **Case queue + batch intake** — *mock:* `lib/cases.ts` (static roster) + `lib/caseStatus.ts`
   (disk JSON at `bridge/case-status.json`). *Real:* back the queue with your case DB; implement
   batch intake = a list of `{package_name, version_code, category, metadata_score}` + download each
   APK + (on install) a decompiled-sources folder. Keep the `CaseRecord`/`QueueStatus` shapes and the
   `metadata_score ≥ METADATA_DISPATCH_GATE (8)` routing gate (sub-gate cases stay `below_gate` until a
   human escalates). The `/queue` UI reads these unchanged.

2. **Install & Decompile ("slice")** — *mock:* `caseStatus.installAndDecompile()` just flips
   `installed`/`decompile` flags. *Real:* run `adb install <apk>` then a real decompiler
   (jadx / apktool) into the sources tree the board renders (`sources/...` paths in node signatures).
   **Gate Sky Walker on a 100% slice** — if decompilation is incomplete, set `decompile:"failed"` and do
   **not** arm the agent (this gating already exists; keep it). Wire it behind the existing
   `POST /api/cases/[id]/action {action:"install_decompile"}`.

3. **Sky Walker dispatch (the static research agent)** — *mock:* manual + placeholder
   `agent_report`. *Real:* dispatch an LLM subagent **per rubric** with its gem playbook
   (`gems/riskware/skywalker.gem.md` + the rubric's `chains.yaml`, `graph.yaml`,
   `evidence_contract.yaml`, `search_strategy.yaml`). It hunts the decompiled sources
   ("meet in the middle from sources→sinks", `match behavior, not names` via each node's
   `flexible_match`), and reports run-status back through
   `POST /api/cases/[id]/action {action:"agent_report", run:"static_running"|"static_done"}`.
   On `static_done` it must produce the **confirmed chains** (which of the rubric's signals fired)
   → the binary-per-chain score the UI shows.

4. **Static-potential routing (GATE-2)** — *spec:* `gems/riskware/rubrics/<id>/search_strategy.yaml`
   (`static_potential_scoring` weights + `dynamic_escalation_threshold`). *Real:* implement the
   weighted scorer (the dead stub was removed); it decides escalation to dynamic and awards **0** rubric
   points (routing only).

5. **Mission compilation** — *mock:* `lib/gems/goldenMission.ts` always compiles the one golden
   `m_8821`. *Real:* **mint a unique `mission_id` per (package, version)** and compile a `MissionContext`
   from the confirmed rubric graph + the located static signatures (`compileFlowGraph`). This is what
   makes the bridge hold many packages — the transfer ledger already keys by `mission_id` + carries
   `package_name`/`version_code`; only the constant id is the gap.

6. **Known-riskware-URL DB** — *mock:* `lib/known-urls.ts` seed. *Real:* persist it; the C2 rubric +
   the URL-corroboration badge read it.

## Ship the mission
`/bridge` → **Export mission bundle** → `darkbridge-mission-<id>-<short>.json`. Carry it to Vader.
When Vader's evidence bundle returns, **Import** it → reconcile → score. The **transfer ledger** (`/bridge`)
shows, per package/version, what arrived, what's complete, duplicate carries, and **Mark done**.

## Keep intact (don't refactor)
- `lib/contract.ts` message shapes; `lib/bridge-fs.ts` bundle format + checksum/artifact verification.
- The scoring model: **binary per chain** (`lib/score.ts`); gradation is cross-chain (8/4/2).
- The fail-safe guard: `graph.required_nodes === chain.required_nodes` (CI enforces it).

## Verify
`npm run diagnose` (full in-process round-trip → strong 8) and `npm test` must stay green.
