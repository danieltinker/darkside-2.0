# Rubric / Gem System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize darkside from one hardcoded `mmp_cloaking` flow into a file-backed `Category → Rubric → Chain` knowledge layer driven by agent gems, rendered through a two-altitude graph + boundary proof table — as a demo-ready simulation.

**Architecture:** YAML gem data files under `gems/` are the durable source of truth. Server-only `lib/gems/*` loads + validates them (Zod) and compiles a rubric graph into the existing `FlowGraph`/`MissionContext` runtime. The PixelBridge produce path emits the gem-compiled mission; the client renders it via the existing bridge DTO. Scoring stays binary-per-chain; the app total is the sum of confirmed chains.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · `yaml` (parser) · `zod` (validation) · `vitest` (logic unit tests). Existing: `bridge-fs.ts` real filesystem bridge, `/api/bridge/*`.

**Spec:** `docs/superpowers/specs/2026-05-30-rubric-gem-system-design.md`

---

## File Structure

**Create (gem data — YAML source of truth):**
- `gems/riskware/skywalker.gem.md` · `gems/yoda.orchestrator.gem.md` · `gems/yoda.reconciliation.gem.md` — agent instructions (from spec §6).
- `gems/riskware/category.yaml` — rubric registry + scoring/qualification policy.
- `gems/riskware/rubrics/attribution_gated_webview_uncloaking/{rubric,graph,chains,evidence_contract,search_strategy}.yaml`
- `gems/riskware/category_memory/{known_riskware_urls,known_false_positives,approved_patterns}.yaml`

**Create (TS):**
- `lib/gems/types.ts` — Gem/Category/Rubric/Chain/Graph types + Zod schemas.
- `lib/gems/loadGem.ts` — server-only YAML→typed loader + validator.
- `lib/gems/compileMission.ts` — rubric gem → `FlowGraph`/`MissionContext`.
- `lib/gems/goldenMission.ts` — server-only: `getCompiledMission()` for the golden case.
- `lib/gems/scoreStaticPotential.ts` · `lib/gems/aggregateScore.ts` · `lib/gems/buildVaderExperiments.ts`
- `components/BoundaryTable.tsx` — the 4-boundary proof table.
- `components/ActionSummary.tsx` — the action-summary (high) altitude of the graph.
- Test files: `lib/gems/__tests__/*.test.ts`.

**Modify:**
- `lib/contract.ts` — `ioc` → `rubric{...}`; add `dynamic_aids?`; add `FlowNode` fields (`behavioral_role?`, `phase?`, `boundary?`, `flexible_match?`).
- `lib/mock.ts` — build `missionContext.rubric` instead of `ioc`.
- `lib/score.ts` — add `aggregateScore` consumers reference; keep binary-per-chain.
- `app/api/bridge/mission/route.ts` + `app/api/bridge/demo/route.ts` — produce the gem-compiled mission.
- `components/MissionCard.tsx` — render `rubric` chip + integrate `BoundaryTable`/`ActionSummary`.
- `components/CallGraph.tsx` — add the two-altitude grouping.
- `package.json` — deps + `test` script.

---

## Task 1: Dependencies + vitest harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install deps**

Run: `cd /Users/danielbaruch/darkside-2.0 && npm install yaml zod && npm install -D vitest`
Expected: packages added, no errors.

- [ ] **Step 2: Add test script to package.json**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
});
```

- [ ] **Step 4: Smoke test the harness**

Create `lib/gems/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("harness", () => { it("runs", () => { expect(1 + 1).toBe(2); }); });
```
Run: `npm test`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/gems/__tests__/smoke.test.ts
git commit -m "chore: add yaml + zod + vitest harness"
```

---

## Task 2: Author the rubric graph YAML (faithful 1:1 of the golden case)

The compiled mission must reproduce the existing golden case exactly, so `graph.yaml` is a 1:1 translation of `lib/flow.ts` (`mmpCloakingGraph`, lines 25-244) into YAML, plus the new altitude fields (`phase`, `boundary`, `behavioral_role`).

**Files:**
- Create: `gems/riskware/rubrics/attribution_gated_webview_uncloaking/graph.yaml`

- [ ] **Step 1: Write `graph.yaml` header + node schema**

```yaml
graph_id: attribution_gated_webview_uncloaking_v1
rubric_id: attribution_gated_webview_uncloaking
schema_version: "1.0.0"
entry: n1_callback
required_nodes: [n1_callback, n2_parse, n3_load]   # boundary nodes that gate the score
nodes:
  - node_id: n1_callback
    stage: 1
    phase: acquisition                # action-summary altitude
    boundary: acquisition_signal      # which scoring boundary (null if none)
    behavioral_role: attribution_payload_entry
    label: onConversionDataSuccess
    kind: trigger
    static_confirmed: true
    frida_hook: com.adtrack.attr.AttribListener.onConversionDataSuccess
    flexible_match:
      examples: [onConversionDataSuccess, onAttributionChanged, onInstallReferrerSetupFinished]
      match_type: semantic_or_api_family
    signature:
      class_name: com.adtrack.attr.AttribListener
      method: onConversionDataSuccess(java.util.Map)
      file_path: sources/com/adtrack/attr/AttribListener.java
      line: 42
      snippet: |
        public void onConversionDataSuccess(Map<String, Object> data) {
            String tok = String.valueOf(data.get("af_adset"));
            a.invoke(data);          // hand off to URL builder
        }
```

- [ ] **Step 2: Translate the remaining 8 nodes 1:1 from `lib/flow.ts`**

For each node in `lib/flow.ts` (`n2_invoke`, `n2_http`, `n2_parse`, `n2_deobf`, `n3_o`, `n3_coro`, `n3_native`, `n3_load`) copy `node_id`, `stage`, `label`, `kind`, `static_confirmed`, `frida_hook`, `signature{...}`, and where present `produces_url`, `decryptor{...}`, `native_file{...}` verbatim into the YAML shape above. Add these altitude fields per node:

| node_id | phase | boundary | behavioral_role |
|---|---|---|---|
| n2_invoke | url_build | (none) | runtime_url_builder |
| n2_http | url_build | (none) | remote_destination_resolution |
| n2_parse | url_build | destination_resolution | attribution_field_extraction |
| n2_deobf | url_build | (none) | runtime_url_builder |
| n3_o | sink | (none) | browser_container_setup |
| n3_coro | sink | (none) | dispatch_indirection |
| n3_native | sink | (none) | native_dispatch |
| n3_load | sink | render | in_app_destination_render |

(`n2_parse` carries the `destination_resolution` boundary and `n3_load` the `render` boundary, matching `required_nodes`; `n1_callback` carries `acquisition_signal`. The `cloaking_gate` boundary has no node in the current 9-node golden graph — note this in the file as a comment: the gate is implicit in the MMP golden case and will get its own node when the behavioral 13-node graph lands.)

- [ ] **Step 3: Translate the 9 edges 1:1 from `lib/flow.ts` (lines 233-243)**

```yaml
edges:
  - { from: n1_callback, to: n2_invoke, relation: calls }
  - { from: n2_invoke,  to: n2_http,    relation: calls }
  - { from: n2_http,    to: n2_parse,   relation: returns }
  - { from: n2_parse,   to: n2_deobf,   relation: data_to }
  - { from: n2_deobf,   to: n2_invoke,  relation: returns }
  - { from: n2_invoke,  to: n3_o,       relation: data_to }
  - { from: n3_o,       to: n3_coro,    relation: calls }
  - { from: n3_coro,    to: n3_native,  relation: calls }
  - { from: n3_native,  to: n3_load,    relation: triggers }
```

- [ ] **Step 4: Commit**

```bash
git add gems/riskware/rubrics/attribution_gated_webview_uncloaking/graph.yaml
git commit -m "feat(gems): attribution_gated_webview_uncloaking graph.yaml (1:1 golden case)"
```

---

## Task 3: Author the remaining rubric + category YAML

**Files:**
- Create: `gems/riskware/category.yaml`
- Create: `.../attribution_gated_webview_uncloaking/{rubric,chains,evidence_contract,search_strategy}.yaml`
- Create: `gems/riskware/category_memory/{known_riskware_urls,known_false_positives,approved_patterns}.yaml`

- [ ] **Step 1: `category.yaml`**

```yaml
category_id: riskware
gem_type: category
name: Riskware Category Gem
version: 0.1.0
status: active
operating_model: { static_owner: yoda, dynamic_owner: darth_vader, bridge: pixelbridge, human_review_required: true }
dispatch_gate: { metadata_score_gte: 8 }     # GATE 1: Yoda dispatches Sky Walker only when metadata_score >= 8
scoring_model: { strong: 8, medium: 4, weak: 2, confirmed_tp_threshold: 8 }
rubrics:
  - rubric_id: attribution_gated_webview_uncloaking
    status: active
    skywalker_gem: gems/riskware/skywalker.gem.md
learning_policy: { canonical_gems_mutable_by_agent: false, human_approval_required_for_promotion: true, auto_promote: false }
```

- [ ] **Step 2: `chains.yaml`** (binary per chain — only the strong_8 chain now)

```yaml
rubric_id: attribution_gated_webview_uncloaking
chains_version: 0.1.0
chains:
  - chain_id: attribution_gated_webview_uncloaking_strong_8
    name: Full attribution-gated WebView uncloaking
    strength: strong
    points: 8
    score_mode: all_or_nothing
    required_boundaries: [acquisition_signal, destination_resolution, render]
    required_nodes: [n1_callback, n2_parse, n3_load]
# NOTE: 4-pt / 2-pt chains appended later by the user. aggregateScore sums confirmed chains.
```

(Boundaries listed match the current 9-node golden graph's `required_nodes`. `cloaking_gate` joins when the 13-node behavioral graph lands.)

- [ ] **Step 3: `rubric.yaml`**

```yaml
rubric_id: attribution_gated_webview_uncloaking
gem_type: rubric
category: riskware
name: Attribution-Gated WebView Uncloaking
version: 0.1.0
status: active
severity: high
required_behavioral_boundaries: [acquisition_signal, cloaking_gate, destination_resolution, render]
flexible_anchor_signals:
  attribution_callbacks: { examples: [onConversionDataSuccess, AppsFlyerConversionListener, onAttributionChanged, InstallReferrerClient], match_type: semantic_or_api_family }
  attribution_fields:    { examples: [af_status, media_source, campaign, referrer, url, dl, deep_link_value], match_type: fuzzy_key_and_dataflow }
  gate_values:           { examples: [Organic, Non-organic, affiliate, targeted_geo, reviewer, sandbox], match_type: semantic_condition }
  destination_resolution:{ examples: [Uri.parse, buildUpon, JSONObject.optString, Base64.decode, XOR, "HTTP 302 Location"], match_type: semantic_or_api_family }
  browser_sinks:         { examples: [WebView.loadUrl, WebView.postUrl, evaluateJavascript, CustomTabsIntent.launchUrl], match_type: sink_family }
important_note: Exact method names are high-value anchor hints but are NOT required. The rubric is behavior-based.
```

- [ ] **Step 4: `evidence_contract.yaml`** (binary — no medium-as-partial)

```yaml
rubric_id: attribution_gated_webview_uncloaking
contract_version: 0.1.0
principle: Match behavior, not names. Anchors are hints; prove dataflow across boundaries.
strong_8_requires:
  - { id: acquisition_signal_enters_app_logic, boundary: acquisition_signal, static_or_dynamic: either_but_dynamic_preferred }
  - { id: destination_resolved_at_runtime,     boundary: destination_resolution, static_or_dynamic: dynamic_required }
  - { id: destination_rendered_in_app,         boundary: render, static_or_dynamic: dynamic_required }
reject_strong_if:
  - no dataflow between attribution/referrer signal and browser sink
  - destination is a fixed first-party URL
  - only organic/benign branch executes under non-organic mock
artifact_requirements:
  for_strong: [callback_trace, destination_value_capture, browser_sink_trace, screenshot_or_render_confirmation]
learning_candidate_triggers: [new_attribution_provider, new_destination_field, new_obfuscation_method, new_in_app_browser_sink, same_behavior_different_names]
```

- [ ] **Step 5: `search_strategy.yaml`** (static-potential = routing gate only)

```yaml
rubric_id: attribution_gated_webview_uncloaking
strategy_version: 0.1.0
agent_instruction: Prove a behavioral chain (signal -> gate -> runtime destination -> in-app render), not a specific API chain. Meet in the middle from sources and sinks.
static_potential_scoring:   # GATE 2: routing only — awards 0 rubric points
  attribution_source_found: 15
  field_extraction_found: 15
  conditional_gate_found: 20
  url_builder_or_decryptor_found: 20
  browser_sink_found: 20
  static_source_to_sink_dataflow_found: 30
  known_bad_or_affiliate_domain_found: 15
dynamic_escalation_threshold: 60
```

- [ ] **Step 6: `category_memory/*.yaml`** (seed from existing mock known-URLs)

`known_riskware_urls.yaml` — translate the two entries in `lib/mock.ts` `knownUrlSeed` (lines 309-326) 1:1 into YAML list form. `known_false_positives.yaml` and `approved_patterns.yaml`:
```yaml
# known_false_positives.yaml
version: 0.1.0
entries: []
```
```yaml
# approved_patterns.yaml — human-blessed variants promoted from learning_candidates
version: 0.1.0
patterns: []
```

- [ ] **Step 7: Commit**

```bash
git add gems/riskware
git commit -m "feat(gems): riskware category + rubric YAML (chains, evidence, search, memory)"
```

---

## Task 4: The three gem `.md` instruction assets

**Files:**
- Create: `gems/riskware/skywalker.gem.md`, `gems/yoda.orchestrator.gem.md`, `gems/yoda.reconciliation.gem.md`

- [ ] **Step 1: Write the three gems verbatim from spec §6**

Copy the three fenced markdown gem bodies from `docs/superpowers/specs/2026-05-30-rubric-gem-system-design.md` §6a/§6b/§6c into the three files respectively (they are complete in the spec).

- [ ] **Step 2: Commit**

```bash
git add gems/riskware/skywalker.gem.md gems/yoda.orchestrator.gem.md gems/yoda.reconciliation.gem.md
git commit -m "feat(gems): Sky Walker + Yoda orchestrator + reconciliation gem instructions"
```

---

## Task 5: Gem types + Zod schemas

**Files:**
- Create: `lib/gems/types.ts`
- Test: `lib/gems/__tests__/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { ChainSchema } from "@/lib/gems/types";

describe("ChainSchema", () => {
  it("accepts a valid strong chain", () => {
    const r = ChainSchema.safeParse({
      chain_id: "x", name: "X", strength: "strong", points: 8,
      score_mode: "all_or_nothing", required_boundaries: ["render"], required_nodes: ["n3_load"],
    });
    expect(r.success).toBe(true);
  });
  it("rejects points outside 8/4/2", () => {
    const r = ChainSchema.safeParse({
      chain_id: "x", name: "X", strength: "strong", points: 5,
      score_mode: "all_or_nothing", required_boundaries: [], required_nodes: [],
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- types`
Expected: FAIL (`ChainSchema` not exported).

- [ ] **Step 3: Implement `lib/gems/types.ts`**

```ts
import { z } from "zod";

export const ChainSchema = z.object({
  chain_id: z.string(),
  name: z.string(),
  strength: z.enum(["strong", "medium", "weak"]),
  points: z.union([z.literal(8), z.literal(4), z.literal(2)]),
  score_mode: z.literal("all_or_nothing"),
  required_boundaries: z.array(z.string()),
  required_nodes: z.array(z.string()),
});
export type Chain = z.infer<typeof ChainSchema>;

export const FlexibleMatchSchema = z.object({
  examples: z.array(z.string()),
  match_type: z.string(),
});

const DecryptorSchema = z.object({
  algorithm: z.enum(["base64", "xor", "aes", "rc4", "custom"]),
  key_source: z.string(),
  decrypted_strings: z.array(z.object({ ciphertext: z.string(), plaintext: z.string(), note: z.string().optional() })),
});
const NativeFileSchema = z.object({
  native_id: z.string(), name: z.string(), sha256: z.string(),
  exported_symbol: z.string().optional(), confirmed_active: z.boolean(), activity_note: z.string(),
});

export const GemNodeSchema = z.object({
  node_id: z.string(),
  stage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  phase: z.string(),
  boundary: z.string().nullable().optional(),
  behavioral_role: z.string().optional(),
  label: z.string(),
  kind: z.enum(["trigger", "dispatch", "http", "parse", "deobf", "sink"]),
  static_confirmed: z.boolean(),
  frida_hook: z.string(),
  produces_url: z.boolean().optional(),
  flexible_match: FlexibleMatchSchema.optional(),
  decryptor: DecryptorSchema.optional(),
  native_file: NativeFileSchema.optional(),
  signature: z.object({
    class_name: z.string(), method: z.string(), file_path: z.string(), line: z.number(), snippet: z.string(),
  }),
});
export type GemNode = z.infer<typeof GemNodeSchema>;

export const GemEdgeSchema = z.object({
  from: z.string(), to: z.string(),
  relation: z.enum(["calls", "returns", "data_to", "triggers"]),
});

export const GraphGemSchema = z.object({
  graph_id: z.string(), rubric_id: z.string(), schema_version: z.string(),
  entry: z.string(), required_nodes: z.array(z.string()),
  nodes: z.array(GemNodeSchema), edges: z.array(GemEdgeSchema),
});
export type GraphGem = z.infer<typeof GraphGemSchema>;

export const ChainsFileSchema = z.object({
  rubric_id: z.string(), chains_version: z.string(), chains: z.array(ChainSchema),
});

export const CategorySchema = z.object({
  category_id: z.string(), name: z.string(), version: z.string(), status: z.string(),
  dispatch_gate: z.object({ metadata_score_gte: z.number() }),
  scoring_model: z.object({ strong: z.number(), medium: z.number(), weak: z.number(), confirmed_tp_threshold: z.number() }),
  rubrics: z.array(z.object({ rubric_id: z.string(), status: z.string(), skywalker_gem: z.string() })),
});
export type Category = z.infer<typeof CategorySchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- types`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/gems/types.ts lib/gems/__tests__/types.test.ts
git commit -m "feat(gems): typed Zod schemas for category/rubric/graph/chain"
```

---

## Task 6: YAML loader (server-only)

**Files:**
- Create: `lib/gems/loadGem.ts`
- Test: `lib/gems/__tests__/loadGem.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { loadGraphGem, loadChains, loadCategory } from "@/lib/gems/loadGem";

const RUBRIC = "attribution_gated_webview_uncloaking";

describe("loadGem", () => {
  it("loads + validates the graph gem with 9 nodes", () => {
    const g = loadGraphGem(RUBRIC);
    expect(g.nodes).toHaveLength(9);
    expect(g.required_nodes).toEqual(["n1_callback", "n2_parse", "n3_load"]);
  });
  it("loads the strong_8 chain", () => {
    const c = loadChains(RUBRIC);
    expect(c.chains[0].points).toBe(8);
  });
  it("loads the category with metadata gate 8", () => {
    expect(loadCategory("riskware").dispatch_gate.metadata_score_gte).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- loadGem`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/gems/loadGem.ts`**

```ts
import "server-only";
import { promises as fsp, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import {
  GraphGemSchema, ChainsFileSchema, CategorySchema,
  type GraphGem, type Category,
} from "./types";

const ROOT = process.cwd();
const GEMS = path.join(ROOT, "gems");

function readYaml(rel: string): unknown {
  return parse(readFileSync(path.join(GEMS, rel), "utf8"));
}

export function loadGraphGem(rubricId: string): GraphGem {
  const raw = readYaml(`riskware/rubrics/${rubricId}/graph.yaml`);
  return GraphGemSchema.parse(raw);
}

export function loadChains(rubricId: string) {
  const raw = readYaml(`riskware/rubrics/${rubricId}/chains.yaml`);
  return ChainsFileSchema.parse(raw);
}

export function loadCategory(categoryId: string): Category {
  const raw = readYaml(`${categoryId}/category.yaml`);
  return CategorySchema.parse(raw);
}

// Raw markdown gem text (the agent instruction asset).
export async function loadGemText(rel: string): Promise<string> {
  return fsp.readFile(path.join(GEMS, rel), "utf8");
}
```

(Uses `readFileSync` so the loader is usable from both route handlers and vitest without async plumbing. `server-only` guards against client import.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- loadGem`
Expected: PASS (3 tests). If a Zod error fires, fix the YAML field that mismatches `types.ts` — do not loosen the schema.

- [ ] **Step 5: Commit**

```bash
git add lib/gems/loadGem.ts lib/gems/__tests__/loadGem.test.ts
git commit -m "feat(gems): server-only YAML loader + validator"
```

---

## Task 7: Contract generalization (`ioc` → `rubric`, additive node fields)

**Files:**
- Modify: `lib/contract.ts`

- [ ] **Step 1: Replace the `ioc` field on `MissionContext`**

In `lib/contract.ts`, change (line ~100):
```ts
  ioc: { ioc_id: "mmp_cloaking"; name: string; points_if_strong: 8 };
```
to:
```ts
  rubric: {
    category_id: string;
    rubric_id: string;
    chain_id: string;
    name: string;
    points_if_strong: 8 | 4 | 2;
    gem_version: string;
  };
  dynamic_aids?: {
    frida_hooks?: { node_id: string; target: string }[];
    mock_responses?: { label: string; when: string; payload: unknown }[];
    decryptors?: Decryptor[];
  };
```

- [ ] **Step 2: Add additive fields to `FlowNode`**

In `lib/contract.ts`, inside `FlowNode` (after `native_file?`), add:
```ts
  behavioral_role?: string;
  phase?: string;
  boundary?: string | null; // scoring boundary this node serves
  flexible_match?: { examples: string[]; match_type: string };
```

- [ ] **Step 3: Typecheck to find all break sites**

Run: `npx tsc --noEmit`
Expected: errors in `lib/mock.ts` (builds `ioc`) and any UI reading `mission.ioc`. These are fixed in Tasks 8 + 10-12. Note the list.

- [ ] **Step 4: Commit**

```bash
git add lib/contract.ts
git commit -m "feat(contract): generalize ioc -> rubric + dynamic_aids + node altitude fields"
```

---

## Task 8: compileMission + gem-loaded golden mission, wired into the bridge

**Files:**
- Create: `lib/gems/compileMission.ts`
- Create: `lib/gems/goldenMission.ts`
- Test: `lib/gems/__tests__/compileMission.test.ts`
- Modify: `lib/mock.ts`, `app/api/bridge/mission/route.ts`, `app/api/bridge/demo/route.ts`

- [ ] **Step 1: Write the failing test (compiled graph equals the golden flow)**

```ts
import { describe, it, expect } from "vitest";
import { compileFlowGraph } from "@/lib/gems/compileMission";
import { loadGraphGem } from "@/lib/gems/loadGem";
import { mmpCloakingGraph } from "@/lib/flow";

describe("compileFlowGraph", () => {
  it("reproduces the golden 9-node flow graph (ids, edges, required_nodes)", () => {
    const g = compileFlowGraph(loadGraphGem("attribution_gated_webview_uncloaking"));
    expect(g.nodes.map((n) => n.node_id)).toEqual(mmpCloakingGraph.nodes.map((n) => n.node_id));
    expect(g.edges).toEqual(mmpCloakingGraph.edges);
    expect(g.required_nodes).toEqual(mmpCloakingGraph.required_nodes);
    const deobf = g.nodes.find((n) => n.node_id === "n2_deobf")!;
    expect(deobf.decryptor?.algorithm).toBe("xor");
    expect(deobf.produces_url).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- compileMission`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/gems/compileMission.ts`**

```ts
import type { FlowGraph, FlowNode } from "@/lib/contract";
import type { GraphGem, GemNode } from "./types";

function toFlowNode(n: GemNode): FlowNode {
  return {
    node_id: n.node_id,
    stage: n.stage,
    label: n.label,
    kind: n.kind,
    signature: n.signature,
    frida_hook: n.frida_hook,
    static_confirmed: n.static_confirmed,
    produces_url: n.produces_url,
    decryptor: n.decryptor,
    native_file: n.native_file,
    behavioral_role: n.behavioral_role,
    phase: n.phase,
    boundary: n.boundary ?? null,
    flexible_match: n.flexible_match,
  };
}

export function compileFlowGraph(gem: GraphGem): FlowGraph {
  return {
    entry: gem.entry,
    nodes: gem.nodes.map(toFlowNode),
    edges: gem.edges.map((e) => ({ from: e.from, to: e.to, relation: e.relation })),
    required_nodes: gem.required_nodes,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- compileMission`
Expected: PASS. If node order/edges differ, fix `graph.yaml` (Task 2) to match `flow.ts` exactly — the YAML is the thing under test.

- [ ] **Step 5: Implement `lib/gems/goldenMission.ts` (server-only)**

```ts
import "server-only";
import type { MissionContext } from "@/lib/contract";
import { caseIdentity, queueLock, MISSION_ID } from "@/lib/mock";
import { stampMission } from "@/lib/bridge";
import { loadGraphGem, loadChains, loadCategory } from "./loadGem";
import { compileFlowGraph } from "./compileMission";

const RUBRIC = "attribution_gated_webview_uncloaking";

// Compile the golden MissionContext from the gem files (replaces the hardcoded one).
export function getCompiledMission(): MissionContext {
  const cat = loadCategory("riskware");
  const chain = loadChains(RUBRIC).chains[0];
  const flow = compileFlowGraph(loadGraphGem(RUBRIC));
  return stampMission({
    schema_version: "1.0.0",
    type: "MissionContext",
    mission_id: MISSION_ID,
    sent_by: "yoda",
    sent_to: "darth_vader",
    case_identity: caseIdentity,
    queue_lock: queueLock,
    rubric: {
      category_id: cat.category_id,
      rubric_id: RUBRIC,
      chain_id: chain.chain_id,
      name: "Attribution-Gated WebView Uncloaking",
      points_if_strong: chain.points,
      gem_version: cat.version,
    },
    flow,
    status: "MISSION_SENT",
    created_at: "2026-05-29T08:02:00Z",
  });
}
```

- [ ] **Step 6: Update `lib/mock.ts` — `missionContext` uses `rubric` (keeps the client export working for non-bridge consumers/tests)**

In `lib/mock.ts`, replace the `ioc: {...}` block inside the `missionContext = stampMission({...})` call (lines ~280) with:
```ts
    rubric: {
      category_id: "riskware",
      rubric_id: "attribution_gated_webview_uncloaking",
      chain_id: "attribution_gated_webview_uncloaking_strong_8",
      name: "Attribution-Gated WebView Uncloaking",
      points_if_strong: 8,
      gem_version: "0.1.0",
    },
```
Remove the now-unused `IOC` import if `tsc` flags it.

- [ ] **Step 7: Wire the bridge produce routes to the gem-compiled mission**

`app/api/bridge/mission/route.ts` — replace `import { missionContext } from "@/lib/mock";` with `import { getCompiledMission } from "@/lib/gems/goldenMission";`, then:
```ts
export async function POST() {
  const mission = getCompiledMission();
  await produceMission(mission);
  return Response.json({ ok: true, mission_id: mission.mission_id, checksum: mission.checksum });
}
```
`app/api/bridge/demo/route.ts` — replace its `missionContext` usage with `getCompiledMission()` (call once, pass to `produceMission`).

- [ ] **Step 8: Verify build + the round-trip still works**

Run: `npx tsc --noEmit && npm run build`
Expected: green (UI `mission.ioc` refs will be fixed in Tasks 10-12; if any block the build now, apply the `mission.rubric` rename at those sites as part of this step).
Run (fresh dev server, then): `curl -s -X POST localhost:3000/api/bridge/reset && curl -s -X POST localhost:3000/api/bridge/demo | python3 -m json.tool`
Expected: `importEvidence.checksum_ok: true`, `artifacts_verified: 11`.

- [ ] **Step 9: Commit**

```bash
git add lib/gems/compileMission.ts lib/gems/goldenMission.ts lib/gems/__tests__/compileMission.test.ts lib/mock.ts app/api/bridge/mission/route.ts app/api/bridge/demo/route.ts
git commit -m "feat(gems): compile gem-loaded MissionContext + wire into bridge produce path"
```

---

## Task 9: Scoring across chains (binary) + static potential

**Files:**
- Create: `lib/gems/aggregateScore.ts`, `lib/gems/scoreStaticPotential.ts`
- Test: `lib/gems/__tests__/aggregateScore.test.ts`

- [ ] **Step 1: Write the failing test (binary per chain; sum across chains)**

```ts
import { describe, it, expect } from "vitest";
import { aggregateScore } from "@/lib/gems/aggregateScore";

describe("aggregateScore", () => {
  it("awards a chain's full points only when fully confirmed; partial = 0", () => {
    const r = aggregateScore([
      { chain_id: "a", points: 8, confirmed: true },
      { chain_id: "b", points: 4, confirmed: false }, // partial/unconfirmed
    ]);
    expect(r.total).toBe(8);
    expect(r.max).toBe(12);
  });
  it("sums multiple confirmed chains", () => {
    const r = aggregateScore([
      { chain_id: "a", points: 8, confirmed: true },
      { chain_id: "b", points: 4, confirmed: true },
    ]);
    expect(r.total).toBe(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- aggregateScore`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/gems/aggregateScore.ts`**

```ts
export type ChainResult = { chain_id: string; points: number; confirmed: boolean };

// Binary per chain: a chain contributes its full points only if fully confirmed,
// else 0. The app total is the sum of confirmed chains. (No partial credit.)
export function aggregateScore(chains: ChainResult[]): {
  total: number; max: number; perChain: ChainResult[];
} {
  return {
    total: chains.reduce((s, c) => s + (c.confirmed ? c.points : 0), 0),
    max: chains.reduce((s, c) => s + c.points, 0),
    perChain: chains,
  };
}
```

- [ ] **Step 4: Implement `lib/gems/scoreStaticPotential.ts`** (routing gate; 0 rubric points)

```ts
// Static potential is a ROUTING GATE only — it never awards rubric points.
// weights come from search_strategy.yaml; `found` is the set of matched signal keys.
export function scoreStaticPotential(
  weights: Record<string, number>,
  found: string[],
  threshold: number,
): { score: number; qualifies_for_vader: boolean } {
  const score = found.reduce((s, k) => s + (weights[k] ?? 0), 0);
  return { score, qualifies_for_vader: score >= threshold };
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add lib/gems/aggregateScore.ts lib/gems/scoreStaticPotential.ts lib/gems/__tests__/aggregateScore.test.ts
git commit -m "feat(gems): binary-per-chain aggregate score + static-potential routing gate"
```

---

## Task 10: Two-altitude graph — Action Summary

**Files:**
- Create: `components/ActionSummary.tsx`
- Modify: `components/CallGraph.tsx` (add an altitude toggle), `components/MissionCard.tsx` (render rubric chip)

- [ ] **Step 1: Implement `components/ActionSummary.tsx`**

Groups reconciled nodes by `phase` into action cards; each card rolls up its substeps and shows the worst child status; boundary phases get a ring. (Reads the reconciliation read-model already produced by `lib/reconcile.ts`.)
```tsx
import type { Reconciliation, ReconciledNode } from "@/lib/reconcile";
import { StatusChip } from "./StatusChip";

const PHASE_LABEL: Record<string, string> = {
  acquisition: "Acquire signal",
  url_build: "Resolve destination",
  sink: "Render in WebView",
};

function rollupStatus(nodes: ReconciledNode[]): "confirmed" | "failed" | "pending" {
  if (nodes.some((n) => n.status === "failed")) return "failed";
  if (nodes.every((n) => n.status === "confirmed")) return "confirmed";
  return "pending";
}

export function ActionSummary({
  recon, onJump,
}: { recon: Reconciliation; onJump: (nodeId: string) => void }) {
  const phases = [...new Set(recon.nodes.map((n) => n.node.phase ?? "other"))];
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {phases.map((phase) => {
        const nodes = recon.nodes.filter((n) => (n.node.phase ?? "other") === phase);
        const status = rollupStatus(nodes);
        const isBoundary = nodes.some((n) => n.isRequired);
        const tone = status === "confirmed" ? "green" : status === "failed" ? "red" : "amber";
        return (
          <button
            key={phase}
            onClick={() => onJump(nodes[0].node.node_id)}
            className={`rounded-xl border p-3 text-left transition-colors hover:border-edge-strong ${
              isBoundary ? "border-accent-cyan/40 bg-accent-cyan/[0.04]" : "border-edge bg-bg-card/70"
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink-primary">
                {PHASE_LABEL[phase] ?? phase}
              </span>
              <StatusChip tone={tone} dot label={status} />
            </div>
            <p className="font-mono text-[11px] text-ink-muted">
              {nodes.length} call{nodes.length > 1 ? "s" : ""}
              {nodes.length > 1 ? ` · ${nodes.map((n) => n.node.label.split("(")[0]).slice(0, 3).join(" → ")}…` : ""}
            </p>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add an altitude toggle to `components/CallGraph.tsx`**

Add a `view: "summary" | "trace"` `useState` ("summary" default) at the top of the rendered graph; when `summary`, render `<ActionSummary recon onJump={scrollToNode} />`; when `trace`, render the existing per-node list. `onJump` switches to `trace` and scrolls to the node id (`document.getElementById(nodeId)?.scrollIntoView`). Add a small two-button toggle ("Actions" / "Trace").

- [ ] **Step 3: Render the rubric chip in `components/MissionCard.tsx`**

Replace any `mission.ioc` reference with `mission.rubric` (e.g. `mission.rubric.name` + `· Strong ${mission.rubric.points_if_strong}`).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: green. Then browser: `/bridge` → demo → `/yoda` shows the Actions summary above the trace; toggling to Trace + clicking an action jumps to the node.

- [ ] **Step 5: Commit**

```bash
git add components/ActionSummary.tsx components/CallGraph.tsx components/MissionCard.tsx
git commit -m "feat(ui): two-altitude graph — action summary over node trace"
```

---

## Task 11: Boundary Proof Table

**Files:**
- Create: `components/BoundaryTable.tsx`
- Modify: `components/MissionCard.tsx` (mount the table near the footer)

- [ ] **Step 1: Implement `components/BoundaryTable.tsx`**

```tsx
import type { Reconciliation } from "@/lib/reconcile";
import { StatusChip } from "./StatusChip";

const BOUNDARY_LABEL: Record<string, string> = {
  acquisition_signal: "Acquisition signal",
  cloaking_gate: "Cloaking gate",
  destination_resolution: "Destination resolution",
  render: "In-app render",
};

export function BoundaryTable({ recon }: { recon: Reconciliation }) {
  // One row per boundary present on the graph's nodes.
  const boundaries = [...new Set(
    recon.nodes.map((n) => n.node.boundary).filter((b): b is string => !!b),
  )];
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="text-left font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">
          <th className="py-1">Boundary</th><th>Status</th><th>Node</th><th>Concrete API</th>
        </tr>
      </thead>
      <tbody>
        {boundaries.map((b) => {
          const n = recon.nodes.find((x) => x.node.boundary === b)!;
          const tone = n.status === "confirmed" ? "green" : n.status === "failed" ? "red" : "amber";
          return (
            <tr key={b} className="border-t border-edge-faint align-top">
              <td className="py-1.5 pr-2 text-ink-secondary">{BOUNDARY_LABEL[b] ?? b}</td>
              <td className="pr-2"><StatusChip tone={tone} dot label={n.status} /></td>
              <td className="pr-2 font-mono text-[11px] text-ink-muted">{n.node.node_id}</td>
              <td className="font-mono text-[11px] text-ink-muted">{n.node.signature.class_name}.{n.node.signature.method.split("(")[0]}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Mount it in `MissionCard.tsx`** above the scoring footer with a heading "Boundary proof".

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: green. Browser: reconciled `/yoda` shows the 3 boundaries (acquisition_signal, destination_resolution, render) all `confirmed`.

- [ ] **Step 4: Commit**

```bash
git add components/BoundaryTable.tsx components/MissionCard.tsx
git commit -m "feat(ui): boundary proof table on the evidence board"
```

---

## Task 12: Dynamic aids (Sky Walker → Vader) on the golden mission + display

**Files:**
- Modify: `lib/gems/goldenMission.ts` (attach `dynamic_aids`), `components/MissionCard.tsx` or a small `components/DynamicAids.tsx`

- [ ] **Step 1: Attach dynamic aids in `getCompiledMission()`**

Before `stampMission`, build aids from the compiled flow:
```ts
const aids = {
  frida_hooks: flow.nodes.map((n) => ({ node_id: n.node_id, target: n.frida_hook })),
  mock_responses: [{
    label: "tracker GET response (carries wrapped URL)",
    when: "non_organic attribution",
    payload: { status: "ok", dl: "S0NmW1tdQ0pYW0FUX0ZRXl5dQ0pYW0FUX0ZR" },
  }],
  decryptors: flow.nodes.flatMap((n) => (n.decryptor ? [n.decryptor] : [])),
};
```
Add `dynamic_aids: aids,` to the `stampMission({...})` object.

- [ ] **Step 2: Create `components/DynamicAids.tsx`** — a compact card listing hook count, mock responses, and decryptor algorithms; render it on the Vader view (where `b.data.mission.dynamic_aids` is available) as "Sky Walker aids for this run".

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: green. Browser `/vader` (after demo): the Dynamic Aids card shows 9 hooks + 1 mock response + xor decryptor.

- [ ] **Step 4: Commit**

```bash
git add lib/gems/goldenMission.ts components/DynamicAids.tsx components/*.tsx
git commit -m "feat(gems): Sky Walker dynamic aids on the mission + Vader display"
```

---

## Task 13: Full verification + branch wrap

- [ ] **Step 1: Full gate**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all tests pass; tsc clean; build green with routes `/`, `/yoda`, `/vader`, `/bridge`, `/api/bridge/*`.

- [ ] **Step 2: Browser golden-path walkthrough**

Fresh dev server; `/bridge` → "simulate full transfer" (or `/yoda` produce → `/vader` run/export → import) → confirm: gem-loaded mission renders, Action summary + Trace toggle work, Boundary table shows 3/3 confirmed, score = strong 8, Dynamic Aids on Vader, known-URL badge intact. Capture screenshots.

- [ ] **Step 3: Commit any screenshot/polish; push branch**

```bash
git push -u origin feat/rubric-gem-system
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** §5 file structure → Tasks 2-6; §6 gems → Task 4; §2/§7 graph/chains → Tasks 2-3; §3 anchors → `flexible_match` in Tasks 2/5; §8 two-altitude → Tasks 10-11; §9 learning cycle → memory YAML authored (Task 3) + shape only (generation deferred per spec §13); §10 evidence board → Tasks 11-12 atop existing bridge; §11 contract → Tasks 7-8; metadata gate → `category.yaml` (Task 3) + spec, runtime enforcement deferred (mock golden case is ≥8); dynamic aids → Task 12; scoring → Task 9.
- **Deferred per spec (not gaps):** real LLM/decompiler/Frida/adb; runtime metadata-gate + static-potential *enforcement* (authored as data, not executed); learning-candidate *generation*; the 4/2-pt chains (user appends later — `aggregateScore` + schema already accept them).
- **Type consistency:** `compileFlowGraph`/`getCompiledMission`/`aggregateScore`/`scoreStaticPotential` names are used identically across tasks; `mission.rubric` replaces `mission.ioc` everywhere (Tasks 7,8,10); `boundary` is `string | null` consistently (contract + types + compile).
- **Placeholder scan:** none — every code step has complete code; YAML translation tasks cite the exact source (`lib/flow.ts`) + a full field mapping.
```
