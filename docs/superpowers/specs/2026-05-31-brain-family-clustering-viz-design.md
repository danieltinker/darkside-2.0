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

It exists to let us *see* the model — the full `riskware` family tree and the
attack graph behind every signal. It is explicitly **not** wired into the
product: no nav entry, no shared state, read-only.

**Scope for this build: `riskware` only.** The multi-category "at scale" view is
deferred — the architecture is built multi-category-ready (`BrainModel` holds an
array of categories) so additional categories slot in later with no rework, but
only `riskware` is seeded now.

### Goals
- Faithfully render the **current** `riskware` gem data: 1 category, its 5 real
  rubrics, and their real signals (built from the rubrics/chains we have).
- Make **every signal drillable** into an attack graph:
  - the one **traced** graph (MMP `attribution_gated_webview_uncloaking` strong-8)
    renders from real gem data;
  - every **un-traced** signal renders a **generated MOCK attack graph**, clearly
    flagged "mock — to be replaced", purely for visualization completeness.
- All node info observable (expandable per-node detail).
- A separate browsable window, independent of the project tabs.

### Non-goals (YAGNI)
- No multi-category / synthetic at-scale dataset in this build (deferred; added later).
- No editing, persistence, or gem authoring.
- No auth, no backend service, no realtime.
- No integration into `TopNav` or any product route.
- No role-only **blueprint** fallback — un-traced signals get mock graphs, not blueprints.
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

> Only 1 of 5 rubrics has a traced attack graph today. The board renders the one
> real traced graph plus generated **mock** graphs (flagged, to be replaced) for
> every other signal — so the whole riskware tree is drillable and the coverage
> gap stays visible.

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
technique flows with no per-app signature. **This build does not use blueprints**;
un-traced signals get generated mock graphs instead (see §5). Blueprints are noted
here only for completeness.

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
- Mock graphs are generated inside `loadModel` (server side) and embedded in the
  serialized `BrainModel`, so the client board receives one uniform model.

### File layout
```
brain/
  README.md                      # what it is, how to open (/brain), data sources
  types.ts                       # BrainModel view types (UI-facing, decoupled from gem schemas)
  adapter/
    loadModel.ts                 # server-only: real riskware gems → BrainModel (wraps lib/gems loaders)
  transform/
    mockGraph.ts                 # generate a plausible MOCK AttackGraphView for an un-traced signal
    layout.ts                    # dagre auto-layout helper (positions RF nodes)
    toClusterGraph.ts            # BrainModel → RF nodes/edges (Layer 1)
    toAttackGraph.ts             # AttackGraphView → RF nodes/edges (Layer 2)
  palette.ts                     # kind colors, relation tones (mirrors CallGraph RELATION_TONE), strength chips
  components/
    BrainBoard.tsx               # client root: drill state (Layer 1 ↔ Layer 2)
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
    mockGraph.test.ts            # mock generator: valid node-kinds/relations, required-node coverage
    loadModel.test.ts            # real-gem adapter sanity (counts, wiring, mock attachment)
app/
  brain/
    layout.tsx                   # full-bleed standalone shell (own <main>, no TopNav)
    page.tsx                     # server: load model → <BrainBoard model=.../>
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
  attackGraph: AttackGraphView;       // always present: real traced graph, or generated mock
}
export interface AttackGraphView {
  graphId: string; entry: string; requiredNodes: string[];
  nodes: AttackNodeView[]; edges: AttackEdgeView[];
  source: "traced" | "mock";          // traced = real per-app gem; mock = generated placeholder, to be replaced
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
  # required boundaries, # signals, **"⬡ traced"** badge if any signal has a real graph.
- **SignalNode:** name, **strength chip** (color per strength), points, # required_nodes,
  and a graph-source badge: **"traced"** (real) or **"mock"** (placeholder). Click any
  signal → drill to Layer 2 (always drillable).
- Edges: `Category→Rubric` ("contains"), `Rubric→Signal` ("scored by").
- Affordances: minimap, zoom/pan, fit-view, FilterBar (strength/severity/traced-vs-mock), Legend.

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
- **Traced vs mock:** the real traced graph renders normally. A mock graph
  (`source: "mock"`) renders through the **same** canvas but with a distinct
  visual treatment — dashed node borders + a persistent **"MOCK — placeholder,
  to be replaced"** banner — so it is never mistaken for real coverage.

### Window shell (`app/brain/layout.tsx` + `BrainBoard`)
- Full-bleed standalone page (no `TopNav`), own minimal header: title +
  breadcrumb (Layer 1 ↔ Layer 2). Single riskware board — no tabs in this build
  (category switcher is added when more categories are seeded).
- Reuses existing Tailwind theme tokens (`bg-base`, `accent-*`) so it feels native.

---

## 5. Data — `riskware` only (live gems + generated mocks)

### `brain/adapter/loadModel.ts` (server-only)
Builds the `BrainModel` from real gems:
1. `loadCategory("riskware")` → CategoryView (+ scoring/gate).
2. For each rubric in the category: read `rubric.yaml` (name/severity/boundaries)
   + `loadChains(rubricId)` → SignalView[].
3. **Attach an attack graph to every signal:**
   - If a real traced graph exists for the signal — i.e. the rubric has a
     `graph.yaml` and the chain's `required_nodes` match it (today: only
     `attribution_gated_webview_uncloaking_strong_8`) — `loadGraphGem(rubricId)`
     → AttackGraphView with `source: "traced"`.
   - Otherwise, call `mockGraph(signal, rubric)` → AttackGraphView with
     `source: "mock"`.

Always reflects the live gem files → no drift. Result: 1 category, 5 rubrics,
their real signals, 1 traced graph + N mock graphs.

### `brain/transform/mockGraph.ts` — placeholder graph generator
Deterministic, pure. Given a signal + its rubric, synthesizes a small, plausible
attack graph **for visualization only** (to be replaced by real traced graphs):
- Shapes the flow from the rubric's `required_behavioral_boundaries` when present
  (one node per boundary, in order), else a generic
  `trigger → condition → sink` skeleton scaled to the signal's strength.
- Uses **only** the real 10 node-kinds and 12 edge-relations, so it renders
  identically to traced graphs and is a faithful placeholder.
- Marks `required` nodes to mirror the signal's intended `required_nodes`.
- Leaves `signature`/`frida_hook` empty (or clearly stubbed) and sets
  `source: "mock"` so the UI flags it.
- **Deterministic** (no randomness — seeded off `chain_id`) so layout/tests are stable.

> The mock generator is the one piece with genuine design latitude (how to shape
> a believable placeholder from a signal's metadata). It's a good candidate for a
> hands-on contribution during implementation (see plan).

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
  - `toClusterGraph`: category→rubric→signal counts and edge wiring;
    traced-vs-mock badge correctness; strength→points mapping.
  - `toAttackGraph`: node/edge counts match input; `isRequired` set for
    `required_nodes`; relation/label preserved.
  - `mockGraph`: only valid node-kinds/relations emitted; deterministic for a
    given `chain_id`; required nodes present; `source: "mock"`.
  - `loadModel` (real gems): exactly 1 category, 5 rubrics, expected signal
    counts, exactly 1 **traced** graph (`attribution_gated_webview_uncloaking`),
    all other signals carry **mock** graphs.
- **Manual browser pass** at `/brain`: cluster map renders the riskware tree;
  drilling into the MMP signal shows the 10-node traced graph with signatures;
  drilling into an un-traced signal shows a dashed mock graph with the MOCK banner.
- `npm run typecheck` and `npm run test` green.

---

## 8. Risks / decisions

- **New dependency (`@xyflow/react`, `dagre`):** accepted; isolated to the board.
  If undesired later, the `brain/` lib can be deleted wholesale with no product
  impact.
- **Serialization across server→client:** `BrainModel` is plain JSON-serializable
  (no class instances, no functions) — safe to pass as a prop.
- **Mock-data honesty:** every generated graph is flagged `source: "mock"` and
  rendered with a dashed/banner treatment so it is never mistaken for real
  coverage. Mocks are deterministic placeholders to be replaced by real traces.
- **Multi-category later:** `BrainModel.categories` is already an array and the
  cluster transform is category-agnostic, so adding categories is data-only — no
  structural rework. A category switcher/tab is added at that time.
```
