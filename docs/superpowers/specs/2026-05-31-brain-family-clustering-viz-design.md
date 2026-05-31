# Design: `brain/` — Family-Clustering Visualization Board

**Date:** 2026-05-31
**Branch:** `brain-family-clustering`
**Status:** Approved design — ready for implementation plan
**Type:** Standalone research feature (NOT part of the product work plan)

---

## 1. Purpose

A standalone, browsable research board that visualizes the **family-clustering graph**
of the darkside detection model as two stacked layers:

1. **Clustering layer (taxonomy):** `Category → Rubric → Signal` — the malware
   family tree (currently one category, `riskware`, with 5 rubrics).
2. **Execution layer (attack graph):** the per-app traced flow graph behind a
   signal (nodes = code/runtime steps, edges = control/data relations).

It exists to let us *see* the model — current coverage and its gaps — and to
preview what the model looks like **at scale** with many categories and
techniques. It is explicitly **not** wired into the product: no nav entry, no
shared state, read-only.

### Goals
- Faithfully render the **current** `riskware` gem data (1 category, 5 rubrics,
  their signals, and the single fully-traced attack graph).
- Render an **at-scale** synthetic dataset (multiple categories, many techniques,
  many full attack graphs) with **all node info observable**.
- A separate browsable window, independent of the project tabs.

### Non-goals (YAGNI)
- No editing, persistence, or gem authoring.
- No auth, no backend service, no realtime.
- No integration into `TopNav` or any product route.
- No changes to existing product behavior or files (other than adding the new
  isolated route folder + the `brain/` lib + one dev dependency).

---

## 2. Domain model (source of truth — verified against code)

Hierarchy (`lib/gems/types.ts`, `gems/riskware/*`):

```
CATEGORY (cluster group)   gems/riskware/category.yaml        CategorySchema
  ├─ dispatch_gate.metadata_score_gte: 8   (Yoda dispatch gate)
  ├─ scoring_model: strong 8 / medium 4 / weak 2 / confirmed_tp_threshold 8
  └─ RUBRIC[] (technique)  gems/riskware/rubrics/<id>/rubric.yaml
       ├─ name, severity, points_if_strong, required_behavioral_boundaries[]
       └─ SIGNAL[] = "chains"  .../chains.yaml                ChainSchema
            ├─ strength (strong|medium|weak|non_signal) → points (8|4|2|0)
            ├─ score_mode: all_or_nothing
            └─ ATTACK GRAPH (optional)  .../graph.yaml        GraphGemSchema
                 ├─ entry, required_nodes[]   (boundary/scoring nodes)
                 ├─ NODE[]  GemNodeSchema: kind, phase, boundary, behavioral_role,
                 │          static_confirmed, frida_hook, signature{class,method,file,line,snippet}
                 └─ EDGE[]  GemEdgeSchema: relation (12 kinds), label (branch condition)
```

**Current `riskware` contents:**

| Rubric (`rubric_id`) | Display name | Severity | # Signals | Attack graph |
|---|---|---|---|---|
| `attribution_gated_webview_uncloaking` | Attribution-Gated WebView Uncloaking ("MMP uncloaking") | high | 5 | ✅ `graph.yaml` (10 nodes, 4 required) |
| `device_info_cloaking` | Device info cloaking ("device info") | medium | 9 | ❌ |
| `arbitrary_obfuscated_url_loading` | Arbitrary Obfuscated URL Loading | high | 2 | ❌ |
| `command_and_control` | Command and Control | high | 1 | ❌ |
| `runtime_loading_of_code` | Runtime Loading of Code | high | 2 | ❌ |

> Only 1 of 5 rubrics has a traced attack graph today. The board renders this
> honestly (rich graph + 4 "blueprint/stub" rubrics) — the gap is informative.

**Node kinds (10):** `trigger, dispatch, http, parse, deobf, sink, condition,
benign_branch, assessment, verdict`.

**Edge relations (12):** `calls, returns, data_to, triggers, initializes,
registers, async_triggers, branch_benign, branch_uncloaked,
resolves_or_requests, destination_to_container, loads`.

**Scoring (`lib/score.ts`):** a chain confirms only when **all** its
`required_nodes` pass; otherwise 0 (all-or-nothing). Verdicts:
`confirmed_tp | failed_fp | partial`.

There is also a third, role-only **blueprint** graph tier
(`BlueprintGraphSchema`, `gems/riskware/blueprints/*.graph.yaml`) — generic
technique flows with no per-app signature. The board may surface blueprints as a
fallback "Layer-2 preview" for rubrics that have no traced graph (see §4).

---

## 3. Architecture & isolation

- **Branch:** `brain-family-clustering` (off `main`).
- **New dependency (board-only):** `@xyflow/react` (React Flow v12) + `dagre`
  (deterministic auto-layout). Added to `package.json`; imported only from
  `brain/` and `app/brain/`.
- **No product files modified** except: adding `app/brain/` route folder, the
  `brain/` lib, and the two dependencies. `TopNav` is untouched → the window is
  invisible from product tabs and reached only by navigating to `/brain`.

### Server/client boundary
React Flow is client-side; gems are read with `server-only` fs loaders. So:
- `app/brain/page.tsx` is a **server component**: calls `brain/adapter/loadModel.ts`
  (which wraps the existing `lib/gems/loadGem.ts` loaders), serializes the
  `BrainModel`, and passes it as a prop into the client `<BrainBoard>`.
- The at-scale fixture is plain data, importable on the client directly.

### File layout
```
brain/
  README.md                      # what it is, how to open (/brain), data sources
  types.ts                       # BrainModel view types (UI-facing, decoupled from gem schemas)
  adapter/
    loadModel.ts                 # server-only: real gems → BrainModel (wraps lib/gems loaders)
  fixtures/
    atScale.ts                   # synthetic multi-category BrainModel (see §5)
  transform/
    layout.ts                    # dagre auto-layout helper (positions RF nodes)
    toClusterGraph.ts            # BrainModel → RF nodes/edges (Layer 1)
    toAttackGraph.ts             # AttackGraphView → RF nodes/edges (Layer 2)
  palette.ts                     # kind colors, relation tones (mirrors CallGraph RELATION_TONE), strength chips
  components/
    BrainBoard.tsx               # client root: Current|At-Scale tabs + drill state
    ClusterCanvas.tsx            # Layer-1 React Flow canvas
    AttackCanvas.tsx             # Layer-2 React Flow canvas
    Legend.tsx                   # node-kind / edge-relation / strength legend
    FilterBar.tsx                # filter by strength / kind / boundary; search
    nodes/
      CategoryNode.tsx
      RubricNode.tsx
      SignalNode.tsx
      AttackNode.tsx             # rich: kind, boundary, role, static_confirmed, frida_hook, expandable signature
  __tests__/
    toClusterGraph.test.ts
    toAttackGraph.test.ts
    loadModel.test.ts            # real-gem adapter sanity (counts, wiring)
app/
  brain/
    layout.tsx                   # full-bleed standalone shell (own <main>, no TopNav)
    page.tsx                     # server: load model → <BrainBoard current=... atScale=.../>
```

### `BrainModel` view types (`brain/types.ts`)
UI-facing types, intentionally decoupled from the zod gem schemas so the board is
stable if gem schemas evolve:

```ts
export interface BrainModel {
  categories: CategoryView[];
}
export interface CategoryView {
  id: string; name: string; version: string; status: string;
  dispatchGate: number; scoring: { strong: number; medium: number; weak: number; confirmedTp: number };
  rubrics: RubricView[];
}
export interface RubricView {
  id: string; name: string; severity: string;
  pointsIfStrong: number; requiredBoundaries: string[];
  signals: SignalView[];
}
export interface SignalView {
  id: string; name: string;
  strength: "strong" | "medium" | "weak" | "non_signal"; points: 8 | 4 | 2 | 0;
  requiredNodes: string[];
  attackGraph?: AttackGraphView;      // present only for traced signals
}
export interface AttackGraphView {
  graphId: string; entry: string; requiredNodes: string[];
  nodes: AttackNodeView[]; edges: AttackEdgeView[];
  source: "traced" | "blueprint";     // traced = per-app signatures; blueprint = role-only preview
}
export interface AttackNodeView {
  id: string; label: string; kind: string; phase: string;
  boundary?: string | null; behavioralRole?: string; isRequired: boolean;
  staticConfirmed?: boolean; fridaHook?: string;
  signature?: { className: string; method: string; filePath: string; line: number; snippet: string };
}
export interface AttackEdgeView { from: string; to: string; relation: string; label?: string }
```

---

## 4. The two layers (UI)

### Layer 1 — Cluster map (`ClusterCanvas`)
React Flow, dagre **left→right**. Nodes: `Category → Rubric → Signal`.
- **CategoryNode:** name, version, status, `dispatch_gate ≥ N`, scoring tiers, rubric count.
- **RubricNode:** display name + `rubric_id`, severity badge, `points_if_strong`,
  # required boundaries, # signals, **"⬡ attack graph"** badge if any signal is traced.
- **SignalNode:** name, **strength chip** (color per strength), points, # required_nodes,
  **"graphed"** badge. Click a graphed signal → drill to Layer 2.
- Edges: `Category→Rubric` ("contains"), `Rubric→Signal` ("scored by").
- Affordances: minimap, zoom/pan, fit-view, FilterBar (strength/severity/graphed), Legend.

### Layer 2 — Attack execution graph (`AttackCanvas`)
React Flow, dagre **top→bottom**. The signal's traced flow.
- **AttackNode** color-coded by `kind`; **required/boundary nodes ringed**.
  Compact by default; click to expand the full card: label, kind, phase, boundary,
  `behavioral_role`, `static_confirmed ✓/✗`, `frida_hook`, and `signature`
  (`class.method`, `file:line`, code snippet).
- Edges labeled with `relation` + branch label; colored via `brain/palette.ts`
  (mirrors `CallGraph.tsx` `RELATION_TONE` for brand consistency).
- Header strip: rubric name · chain name · score (`points_if_strong`) ·
  required-node checklist (✓ count). Back button → Layer 1.
- **Fallback:** if a rubric/signal has no traced graph but a matching blueprint
  exists, show the blueprint with a clear "role-only preview (no per-app trace)"
  banner (`source: "blueprint"`). If neither, show an empty-state explaining the
  coverage gap.

### Window shell (`app/brain/layout.tsx` + `BrainBoard`)
- Full-bleed standalone page (no `TopNav`), own minimal header: title +
  **Current | At Scale** tabs + breadcrumb (Layer 1 ↔ Layer 2).
- Reuses existing Tailwind theme tokens (`bg-base`, `accent-*`) so it feels native.

---

## 5. Data

### Current view — `brain/adapter/loadModel.ts` (server-only)
Builds `BrainModel` from real gems:
1. `loadCategory("riskware")` → CategoryView (+ scoring/gate).
2. For each rubric in the category: read `rubric.yaml` (name/severity/boundaries)
   + `loadChains(rubricId)` → SignalView[].
3. For signals whose rubric has a `graph.yaml`: `loadGraphGem(rubricId)` →
   AttackGraphView (`source: "traced"`), attaching it to the matching chain
   (by `chain_id`/`required_nodes`). Optionally attach a blueprint preview where
   a traced graph is absent.

Always reflects the live gem files → no drift.

### At-Scale view — `brain/fixtures/atScale.ts`
Hand-authored synthetic `BrainModel`, **rich tier** (approved):
- **~4 categories:** `riskware`, `spyware`, `banking_trojan`, `adware`.
- **~15 rubrics total** spread across them, each with realistic
  severity/boundaries.
- **2–4 signals** per rubric across all strengths.
- **~8 fully-populated attack graphs** (every node has kind/phase/boundary/role/
  static_confirmed/frida_hook/signature; edges use the real 12 relations) so the
  "all info in every node, easy to observe" requirement is demonstrably met.
- Rendered through the **same** canvases → proves the board scales.

This is illustrative research data, clearly labeled synthetic in the UI.

---

## 6. Transforms (pure, tested)

- `toClusterGraph(model, opts)` → `{ nodes, edges }` for React Flow (then positioned
  by `layout.ts`). Deterministic; no side effects.
- `toAttackGraph(graph)` → `{ nodes, edges }` for React Flow; flags required nodes,
  maps relations to tones, carries signature payload for the expandable card.
- `layout.ts` wraps dagre to assign x/y (LR for Layer 1, TB for Layer 2).

---

## 7. Testing & verification

- **Vitest unit tests** (pure functions):
  - `toClusterGraph`: category→rubric→signal counts and edge wiring; "graphed"
    flag set iff a signal has an attack graph; strength→points mapping.
  - `toAttackGraph`: node/edge counts match input; `isRequired` set for
    `required_nodes`; relation/label preserved.
  - `loadModel` (real gems): exactly 1 category, 5 rubrics, expected signal
    counts, exactly 1 traced graph (`attribution_gated_webview_uncloaking`).
- **Manual browser pass** at `/brain`: Current tab renders cluster map; drilling
  into the MMP signal shows the 10-node attack graph with signatures; At-Scale
  tab renders 4 category clusters and 8 full graphs without layout breakage.
- `npm run typecheck` and `npm run test` green.

---

## 8. Risks / decisions

- **New dependency (`@xyflow/react`, `dagre`):** accepted; isolated to the board.
  If undesired later, the `brain/` lib can be deleted wholesale with no product
  impact.
- **Serialization across server→client:** `BrainModel` is plain JSON-serializable
  (no class instances, no functions) — safe to pass as a prop.
- **Synthetic data honesty:** the At-Scale view is labeled synthetic in-UI to
  avoid being mistaken for real coverage.
- **Scale rendering perf:** ~4 categories / ~15 rubrics / ~8 graphs is well within
  React Flow's comfort zone; collapse-by-default for signals keeps Layer 1 light.
```
