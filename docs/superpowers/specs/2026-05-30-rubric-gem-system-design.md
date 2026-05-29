# darkside — Rubric / Gem System — Design

**Date:** 2026-05-30
**Builds on:** `2026-05-29-darkseed-mmp-mvp-design.md` (the MMP MVP) and the merged
real-filesystem PixelBridge (`bridge-fs.ts` + `/api/bridge/*`).
**Status:** approved in brainstorm; pending spec review.

---

## 0. Goal

Upgrade the darkside MVP into a **file-backed Rubric/Gem system** that generalizes
the single hardcoded `mmp_cloaking` flow into a scalable
`Category → Rubric → Chain` knowledge layer, driven by configurable agent
**gems** (system-prompt instructions that point to file-backed data).

**Tomorrow's target = a demo-ready *simulation*:** real prompt assets + one
rubric's YAML knowledge + the mock app rendering it all (two-altitude graph,
boundary proof table, live evidence board, binary scoring, human review, real
file-bridge), with **typed seams** where a real decompiler / LLM runtime / Frida /
adb plug in later. **Out of scope now:** running a real LLM over a real APK, a real
static-analysis engine, real Frida/device/adb. Those are roadmap.

---

## 1. Locked decisions (from brainstorm 2026-05-29 → 05-30)

1. **Scope:** blueprint/knowledge layer + real prompt assets, in the mock app. No
   live LLM/decompiler/Frida/adb this iteration.
2. **Taxonomy:** `Category → Rubric → Chain` (3 levels). A Chain is one gradeable
   detection path; "IOC signal" is a concrete signal *inside* a rubric, not the top
   abstraction.
3. **Scoring is binary per chain** (the load-bearing correction):
   - Each chain scores **all-or-nothing**: every required boundary proven (incl.
     required *dynamic* boundaries, confirmed by Vader) → the chain's full points
     (**8 / 4 / 2**). Anything partial → **0**.
   - The 8/4/2 tiers are **distinct, independently-complete behaviors of different
     severity** — *not* degrees of proving one behavior. A 4-pt chain is its own
     complete pattern (e.g. remote-URL→WebView with **no** cloaking gate), never
     "the 8-pt chain minus a boundary."
   - **Investigation score = sum of confirmed chains.** Partial investigation
     scores arise *only* from summing different fully-confirmed chains.
   - `static_potential_score` (0–100 weighted) is a **routing gate only** ("ship to
     Vader?") and earns **0** rubric points.
4. **Gem = agent instruction, lean + file-backed.** The gem is a system prompt that
   *navigates to* the data files it needs at runtime; it does **not** inline the
   rubric data. One gem for all of riskware now; split per-rubric + a gem list +
   parallelism at scale.
5. **Agent topology (decoupled):**
   - **Yoda — orchestrator agent.** **Receives an already-locked app as input**
     (`{package_name, category, metadata_score, identity}`) — it does **not** lock
     the app; locking happens upstream. **Dispatches Sky Walker only when
     `metadata_score >= 8`.** Then **aggregates the app's total score** (sum of
     confirmed chains across rubrics), decides **qualifies-for-dynamic**, owns final
     verdict + reconciliation. Never does per-rubric tracing itself.
   - **Sky Walker — research subagent (⊂ Yoda).** Runs *one* rubric's static
     research → per-rubric `static_potential_report` + candidate graph + boundary
     statuses. **Never computes the app total.**
   - **Darth Vader — dynamic agent** (separate machine): runs experiments, returns
     evidence.
6. **Contract evolution (approved):** generalize `MissionContext.ioc` →
   `rubric {category_id, rubric_id, chain_id, name, points_if_strong, gem_version}`;
   add `behavioral_role`, `flexible_match`, `phase`, `boundary` to `FlowNode`
   (additive / backward-compatible). Keep the existing 9-node MMP graph as the first
   compiled instance; enrich incrementally rather than rewriting to the 13-node
   behavioral graph now.
7. **Evidence return path:** loading/verifying returned evidence into the UI is a
   **deterministic script** (the existing `bridge-fs` import → checksum + sha256 →
   `getState` → render) — *not* an agent. A **Yoda reconciliation gem** optionally
   *reasons* over loaded evidence to propose per-boundary status + verdict; the
   **human-in-the-loop board stays authoritative**.

---

## 2. Graph vs Chain (definition)

- **Graph** = the full map of possible behavioral steps + edges (incl. branches)
  for a rubric. One per rubric. The *territory*.
- **Chain** = a scored path through the graph; names the **required boundaries** and
  carries binary points. Many chains over one graph.

Example — `attribution_gated_webview_uncloaking`:
- **Graph:** lifecycle → SDK init → listener → callback → unpack → **gate** →
  {benign | uncloak} → URL synthesis → resolution → container prep → **render** →
  assessment → verdict.
- **strong_8 chain:** boundaries `acquisition_signal → cloaking_gate →
  destination_resolution → render`, all proven (incl. dynamic) → 8 else 0.
- **(later) 4-pt chain:** `remote_source → destination_resolution → render`, **no
  gate** — a complete, lower-severity behavior → 4 binary.

---

## 3. Anchors (terminology)

An **anchor hint** is a concrete, high-signal indicator (exact API/method/string/
class — `onConversionDataSuccess`, `WebView.loadUrl`, `Base64.decode`, `af_status`)
where the agent *starts tracing*. Anchors are **hints, never requirements** —
confirmation is proving the *behavior* (dataflow across boundaries), because malware
renames/obfuscates. **Flexible** anchors match by family/semantics
(`match_type: semantic_or_api_family | fuzzy_key_and_dataflow | sink_family`), so
alternative SDKs or renamed methods still anchor.

---

## 4. Smart traversal at scale (reserved design)

Not run in the mock (golden case is authored), but the schema is shaped for it:

1. **Index once, not per chain** — inverted index `anchor → code locations` over the
   decompiled app, shared across all chains. Big YAMLs = bigger index, not bigger scan.
2. **Meet-in-the-middle dataflow** — forward from source anchors, backward from sink
   anchors, meet on a shared value (URL var / JSON field / decrypted string). O(b^d) → ~O(b^(d/2)).
3. **Branch-and-bound** on the static-potential gate — drop partial paths that can't
   cross the qualification threshold.
4. **Memoize boundaries → chains are boolean.** Compute each boundary once; each chain
   is a boolean combination over boundaries → O(chains), not O(chains × code).

Formally: subgraph matching of the tiny (~13-node) rubric graph onto the app's
call/dataflow graph — tractable via rare-anchor selectivity + boundary-only matching.

---

## 5. File structure

```
gems/
  yoda.orchestrator.gem.md         # Yoda: dispatch subagents + aggregate total + qualify + own verdict
  yoda.reconciliation.gem.md       # Yoda: returned evidence → per-boundary status → proposed verdict (human flips)
  riskware/
    skywalker.gem.md               # Sky Walker: per-rubric static research subagent
    category.yaml                  # rubric registry + scoring/qualification policy
    rubrics/
      attribution_gated_webview_uncloaking/
        rubric.yaml                # boundaries + flexible anchor sets
        graph.yaml                 # action summary (phase/boundary) + node trace + edges + required_nodes
        chains.yaml                # chains w/ binary points (strong_8 now; +4-pt later)
        evidence_contract.yaml     # per-boundary acceptable proof + reject_strong_if + artifact reqs
        search_strategy.yaml       # multi-pass search + static-potential weights (gate only)
    category_memory/
      known_riskware_urls.yaml     # feeds the existing O(1) known-URL DB
      known_false_positives.yaml
      approved_patterns.yaml       # human-blessed variants promoted from learning_candidates
    learning_candidates/           # agent-proposed variants (never auto-promoted)

lib/gems/
  types.ts                 # Gem/Category/Rubric/Chain/Graph types + generalized rubric field
  loadGem.ts               # YAML → typed objects (+ required-field validation)
  compileMission.ts        # rubric graph → existing FlowGraph-compatible MissionContext
  scoreStaticPotential.ts  # search_strategy weights → static_potential + qualifies_for_vader (data-driven)
  aggregateScore.ts        # Yoda total = sum of confirmed chains across rubrics
  buildVaderExperiments.ts # evidence_contract + adapters → experiment plan (mock)
```

---

## 6. The three gems (authored assets)

### 6a. `gems/riskware/skywalker.gem.md` — Sky Walker (research subagent)

```markdown
# Sky Walker — Static-Analysis Research Subagent (under Yoda)

You research ONE riskware rubric in a decompiled Android app and confirm
BEHAVIORAL CHAINS, not exact API names. You do NOT compute the app's total score —
you report findings for your assigned rubric; Yoda aggregates.

## Knowledge — load at runtime; do not assume contents
- Your assignment + policy:        gems/riskware/category.yaml
- For your assigned rubric, load:
    rubrics/<id>/rubric.yaml            — boundaries + flexible anchor-hint sets
    rubrics/<id>/graph.yaml             — action summary + node-level trace
    rubrics/<id>/evidence_contract.yaml — what proves each boundary; reject rules
    rubrics/<id>/search_strategy.yaml   — multi-pass search + static-potential weights
- Corpus you may consult: category_memory/{known_riskware_urls,known_false_positives,approved_patterns}.yaml

## How you work
1. Anchor hints (onConversionDataSuccess, loadUrl, …) START a trace; they are NOT
   proof and NOT required. Prove the behavior across boundaries:
   acquisition signal → conditional gate → runtime destination resolution → in-app render.
2. Run the rubric's multi-pass search (anchor discovery → dataflow expansion →
   hypothesis → qualification). Use meet-in-the-middle: forward from sources,
   backward from sinks, meet on the URL/value.
3. Build a candidate graph; map every finding to a node AND a boundary.
4. Compute static_potential from the rubric weights. ROUTING GATE ONLY — 0 rubric points.

## Scoring — do not deviate
- A chain scores BINARY: all required boundaries proven (incl. required DYNAMIC
  boundaries, which only Vader can confirm) → full points (8/4/2); partial → 0.
- Static analysis alone NEVER awards a chain's points.
- Never invent partial credit. Report boundary status honestly: confirmed | partial | missing.

## Output (per rubric)
static_potential_report: matched boundaries, candidate nodes, static_potential_score,
qualifies_for_vader (bool) + reason, recommended Vader experiments.

## Optional dynamic aids (best-effort accelerators for Darth Vader)
When static analysis surfaces them, also emit (all optional — never required for a
report): suggested **frida_hooks** (exact hook targets per node), **mock_responses**
(payloads Vader can inject — e.g. the tracker/remote response that carries the wrapped
URL, or a Non-organic attribution payload), and **decryptors** (algorithm + key_source
+ a worked sample) recovered statically. These help Vader reach dynamic evidence faster
but do not change scoring.

If you see a new variant/anchor/sink/gate, emit a learning_candidate — NEVER edit gem files.
```

### 6b. `gems/yoda.orchestrator.gem.md` — Yoda (orchestrator)

```markdown
# Yoda — Orchestrator Agent

You own an app investigation end to end. You do NOT trace rubrics yourself — you
dispatch Sky Walker research subagents and aggregate their results.

## Inputs — the app is already LOCKED upstream; you do NOT lock it
- locked_app: { package_name, category, metadata_score, identity }
- Knowledge: gems/<category>/category.yaml (rubric registry + scoring/qualify policy)

## Flow
1. Receive locked_app. GATE 1 (metadata): if metadata_score < 8, STOP — do not
   dispatch, mark as below-threshold. (This is an upstream-meta routing gate, not a
   rubric score.)
2. If metadata_score >= 8, dispatch a Sky Walker subagent per active rubric in the
   given category (parallelizable). Give each only its rubric assignment.
3. Collect each subagent's static_potential_report + candidate graph + boundary statuses.
4. AGGREGATE the app total = sum of CONFIRMED chains across all rubrics (binary per
   chain; partial chains contribute 0).
5. Decide qualifies_for_dynamic per policy (static-potential gate + dynamic-required
   rubric matched). If not, mark benign/insufficient with reason.
6. If qualified, compile MissionContext (graph nodes, required boundaries, experiment
   plan) and send to Darth Vader over PixelBridge.
7. On EvidenceReturn, hand to the reconciliation gem, then to human review.

## Rules
- Never award points for a partial chain.
- Never mutate canonical gem files; collect learning_candidates for human review.
- MissionContext / EvidenceReturn are the runtime law.

## Output
investigation_summary: per-rubric chain results, app_total_score, max_possible,
qualifies_for_dynamic + reason, dispatched subagents, learning_candidates.
```

### 6c. `gems/yoda.reconciliation.gem.md` — Yoda (reconciliation)

```markdown
# Yoda — Evidence Reconciliation Gem

After Vader's EvidenceReturn is imported and verified (by the bridge script, not by
you), you compare the static candidate graph against the dynamic evidence and PROPOSE
a verdict. The human reviewer is authoritative and may flip any node or the verdict.

## Inputs
- The rubric's evidence_contract.yaml (acceptable proof per boundary; reject_strong_if).
- The MissionContext graph + the imported EvidenceReturn (node_evidence, artifacts,
  native_files, found_urls).

## Per boundary, decide status: confirmed | partial | missing | rejected
- confirmed: the contract's acceptable_proof is met AND (if dynamic_required) a
  dynamic artifact proves it.
- rejected: a reject_strong_if condition holds (e.g. organic & non-organic load the
  same destination → gate isn't cloaking).

## Verdict (binary per chain)
- confirmed_tp: every required boundary of a chain is confirmed → award that chain's points.
- failed_fp: a required boundary is rejected, or an FP rule fires → 0.
- partial: some required boundaries unconfirmed → the chain scores 0 (NOT partial credit).

## Output
boundary_proof_table + proposed verdict + proposed app_total (sum of confirmed
chains) + rationale + any learning_candidates. Mark everything as PROPOSED; await human.
```

---

## 7. Data-file shapes (so the gem pointers are concrete)

- **`category.yaml`** — `category_id`, rubric registry (list of `rubric_id` + status),
  scoring policy (strong/medium/weak = 8/4/2), qualification policy (static-potential
  threshold, dynamic-required conditions, benign-exit conditions), learning policy
  (canonical immutable; human approval to promote).
- **`rubric.yaml`** — `rubric_id`, name, severity, `required_behavioral_boundaries`,
  `flexible_anchor_signals` (attribution_callbacks / attribution_fields / gate_values /
  destination_resolution / browser_sinks, each with `examples[]` + `match_type`).
- **`graph.yaml`** — nodes carry **both altitudes**: summary (`phase`, `boundary`) and
  trace (`behavioral_role`, `flexible_match.examples`, `match_type`,
  `dynamic_required`); edges with relations; `required_nodes`.
- **`chains.yaml`** — each `{chain_id, strength, points, score_mode: all_or_nothing,
  required_boundaries[]}`. Now: `attribution_gated_webview_uncloaking_strong_8`.
- **`evidence_contract.yaml`** — `strong_8_requires` (per-boundary acceptable_proof,
  static_or_dynamic), `reject_strong_if`, `artifact_requirements`,
  `learning_candidate_triggers`.
- **`search_strategy.yaml`** — multi-pass (anchor discovery → dataflow expansion →
  hypothesis → qualification) + `static_potential_scoring` weights + threshold.

---

## 8. Two-altitude graph (UI)

Render the call graph at two zoom levels:
- **Action summary altitude** — nodes grouped by `phase` / `boundary` into ~4–6 action
  cards (*Acquire signal → Cloaking gate → Resolve destination → Render*), each with a
  one-line roll-up (e.g. "resolved via 10 calls: StringBuilder→Base64→XOR→Uri"). The 4
  scoring **boundaries** get the strongest visual weight.
- **Trace altitude** — expand an action → the current per-node static↔dynamic cards
  (function-call trace, the substeps).

Plus a **Boundary Proof Table** component: 4 boundaries × {confirmed | partial | missing
| rejected} + evidence + concrete APIs — the reviewer's at-a-glance summary.

---

## 9. Learning cycle

1. Sky Walker/Vader observe an unanticipated variant → write a `learning_candidate`
   (never edit canonical files).
2. Human reviews → on approval, promote by *kind*:
   - new anchor/sink/gate-field/obfuscation (same behavior, new API) → enrich the
     rubric's `flexible_match` + `approved_patterns.yaml` (**graph enrichment**, not a
     new chain);
   - genuinely distinct gradeable behavior → a **new chain** (+ new graph nodes/edges
     only if the behavior needs steps the graph lacks);
   - new false positive → `known_false_positives.yaml`.
3. Scoring is never auto-changed. `approved_patterns.yaml` is consulted at runtime to
   broaden matching — this is how the system improves after many apps.

---

## 10. Live evidence board

The reviewer report: Case Identity · Rubric · Static Potential · Dynamic Summary ·
**Boundary Proof Table** · Node-by-Node Trace (two-altitude) · Artifacts · FP Checks ·
Score · Human Controls · Learning Candidates.

**Live run:** Vader writes artifacts incrementally; the board already polls
`/api/bridge/state` (~2.5s) and flips nodes pending→confirmed as evidence lands.
Built already: polling, status chips, reconciled card, filesystem explorer. New for the
live board: the Boundary Proof Table + (real-engine, later) incremental per-node emission.

---

## 11. Contract evolution (precise)

```ts
// Yoda input — the app is locked upstream; metadata_score >= 8 gates dispatch.
type LockedApp = {
  package_name: string;
  category: string;          // which category to review (e.g. "riskware")
  metadata_score: number;    // upstream meta gate; >= 8 → dispatch Sky Walker
  identity: CaseIdentity;    // existing fields (version, developer, countries, …)
};

// MissionContext: replace the single hardcoded ioc with a generalized rubric ref.
rubric: {
  category_id: string;
  rubric_id: string;
  chain_id: string;
  name: string;
  points_if_strong: 8 | 4 | 2;
  gem_version: string;
}

// MissionContext: optional dynamic aids Sky Walker hands Vader (best-effort).
dynamic_aids?: {
  frida_hooks?: { node_id: string; target: string }[];
  mock_responses?: { label: string; when: string; payload: unknown }[];
  decryptors?: Decryptor[];   // reuse the existing Decryptor type
};

// FlowNode: additive fields (optional → backward-compatible)
behavioral_role?: string;
phase?: string;
boundary?: string;                 // which scoring boundary this node serves
flexible_match?: { examples: string[]; match_type: string };
```
`score.ts` is already chain-based; add `aggregateScore` (sum confirmed chains across
rubrics). `bridge-fs` serializes whatever `MissionContext` is — no transport change
beyond the type. Keep `ioc` as an optional deprecated alias for one iteration if it
reduces churn.

---

## 12. Typed seams for the real engine (later)

- `StaticEngine` interface: `index(sources) → AnchorIndex`; `traceBoundaries(graph,
  index) → BoundaryResult[]`. Mock impl returns the golden case; real impl does §4.
- `AgentRuntime` interface: `run(gem, context) → report`. Mock returns authored
  reports; real impl calls an LLM with the gem + loaded files.
- `DeviceTransport` interface: `push(bundle)/pull() `. Mock = the file-bundle bridge;
  real impl = `adb push`.
- `DynamicRunner` interface: Frida/HTTP/screenshot hooks. Mock = golden artifacts.

---

## 13. Build phases (demo-ready simulation)

**Minimum demo-ready set = Phases 1–4.**

1. **Gem + loader spine.** Author `gems/` YAML for the one rubric + the 3 gem `.md`
   assets; `lib/gems/types.ts` + `loadGem.ts` (YAML→typed) + `compileMission.ts`
   (gem graph → FlowGraph). Add a YAML parser dep. `tsc`/`build` green.
2. **Gem-loaded mock + contract generalization.** Replace the hardcoded MMP mock with
   the gem-loaded one; generalize `MissionContext.rubric` + node fields; `aggregateScore`
   across chains; data-driven `static_potential` + `qualifies_for_vader`.
3. **Two-altitude graph + Boundary Proof Table.** Action summary ↔ node trace; the
   4-boundary table on the evidence board.
4. **Evidence board / report + reconciliation.** Wire the reconciliation gem's
   *proposed* boundary statuses (authored) + human flips; live polling already present.
5. **Learning candidates + Rubrics library tab.** Author the candidate shape + a
   read-only surface; a browsable `Category → Rubric → Chain` catalog.

**Defer (roadmap):** real LLM runtime, real decompiler + traversal engine, real
Frida/adb. **Additional real chains (4-pt / 2-pt) will be appended later by the user**
into the codebase — the schema and `aggregateScore` must accept them with no refactor
(Firebase example set aside for now).

---

## 14. Definition of done (this iteration)

- `gems/` holds the 3 gem assets + one rubric's YAML knowledge; `lib/gems` loads &
  compiles them into the existing `MissionContext`/`FlowGraph` runtime.
- The app renders the **gem-loaded** golden case (no hardcoded flow), with the
  generalized `rubric` field, two-altitude graph, Boundary Proof Table, binary
  per-chain scoring, the live evidence board, and human review — over the real
  file-bridge.
- Scoring obeys binary-per-chain; the aggregate is sum-of-confirmed-chains; static
  potential is a routing gate worth 0 points.
- Typed seams exist for the real engine; nothing fakes being real.
- `tsc` + `next build` green; browser-verified end to end.
```
