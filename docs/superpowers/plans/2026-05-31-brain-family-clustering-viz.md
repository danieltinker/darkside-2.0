# Brain Family-Clustering Visualization Board — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, browsable research board at `/brain` that visualizes the full `riskware` family-clustering graph — Category → Rubric → Signal taxonomy (10 rubrics / 44 signals from the source-of-truth spreadsheet) drilling into per-signal attack execution graphs (1 real traced graph + 43 generated mocks).

**Architecture:** All new logic lives in an isolated `brain/` lib + an unlinked Next.js route `app/brain/`. The route's server component loads a plain-JSON `BrainModel` (built from a committed taxonomy dataset + the real gem traced-graph + generated mocks) and hands it to a `'use client'` React Flow board. Pure transforms (taxonomy, mock-graph, cluster/attack graph builders, dagre layout) are unit-tested; the React UI is verified manually in the browser. Zero coupling to the product (no `TopNav` entry, no shared state).

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 3 · `@xyflow/react` (React Flow v12) · `@dagrejs/dagre` (auto-layout) · Vitest · `yaml` + existing `lib/gems` loaders.

**Spec:** `docs/superpowers/specs/2026-05-31-brain-family-clustering-viz-design.md`
**Branch:** `brain-family-clustering` (already created, off `main`).

---

## Conventions used in this plan

- Run tests with: `npx vitest run <path>` (single file) or `npm run test` (all). Type-check with `npm run typecheck`.
- The repo's `vitest.config.mts` already resolves the `@/` alias to the repo root. Use `@/brain/...` and `@/lib/...` imports in tests.
- Commit after every task. Commit messages end with the repo's co-author trailer:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- `brain/` files are framework-agnostic TypeScript **except** `adapter/loadModel.ts` (server-only, reads fs) and `components/*.tsx` / `app/brain/*` (React).

---

## File Structure

```
brain/
  types.ts                     # BrainModel view types + strength→points helper
  palette.ts                   # kind colors, edge-relation tones, strength chip styles
  data/
    rubricIdMap.ts             # spreadsheet rubric name ↔ rubric_id + provenance
    riskwareTaxonomy.ts        # GENERATED & committed: 10 rubrics / 44 signals
  transform/
    mockGraph.ts               # signal+rubric → mock AttackGraphView (deterministic)
    toClusterGraph.ts          # BrainModel → React Flow {nodes,edges} (Layer 1)
    toAttackGraph.ts           # AttackGraphView → React Flow {nodes,edges} (Layer 2)
    layout.ts                  # dagre auto-layout helper
  adapter/
    loadModel.ts               # server-only: taxonomy + gem traced graph + mocks → BrainModel
  components/
    BrainBoard.tsx             # client root: drill state (Layer 1 ↔ Layer 2)
    ClusterCanvas.tsx          # Layer-1 React Flow canvas
    AttackCanvas.tsx           # Layer-2 React Flow canvas
    Legend.tsx
    FilterBar.tsx
    nodes/CategoryNode.tsx
    nodes/RubricNode.tsx
    nodes/SignalNode.tsx
    nodes/AttackNode.tsx
  __tests__/
    taxonomy.test.ts
    gemConsistency.test.ts
    mockGraph.test.ts
    toClusterGraph.test.ts
    toAttackGraph.test.ts
    layout.test.ts
    loadModel.test.ts
  README.md
scripts/
  brain-gen-taxonomy.mjs       # parse docs/riskware_rubrics_processed.xlsx → brain/data/riskwareTaxonomy.ts
app/brain/
  layout.tsx                   # full-bleed standalone shell (no TopNav)
  page.tsx                     # server: loadModel() → <BrainBoard model={...} />
```

---

## Task 1: Add dependencies & baseline

**Files:**
- Modify: `package.json` (dependencies)

- [ ] **Step 1: Confirm branch**

Run: `git branch --show-current`
Expected: `brain-family-clustering`

- [ ] **Step 2: Install React Flow + dagre**

Run:
```bash
npm install @xyflow/react@^12 @dagrejs/dagre@^1
```
Expected: both added to `package.json` `dependencies`, `package-lock.json` updated, no errors.

- [ ] **Step 3: Baseline typecheck + tests still green**

Run: `npm run typecheck && npm run test`
Expected: both pass (no `brain/` code yet — this confirms a clean baseline).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(brain): add @xyflow/react + @dagrejs/dagre deps

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: View types + strength→points helper

The board's UI types, intentionally decoupled from the zod gem schemas so the board is stable as gem schemas evolve. The one piece of real logic here (strength→points) gets a test.

**Files:**
- Create: `brain/types.ts`
- Test: `brain/__tests__/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `brain/__tests__/types.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { pointsForStrength, type Strength } from "@/brain/types";

describe("pointsForStrength", () => {
  it("maps strengths to the category scoring tiers", () => {
    expect(pointsForStrength("strong")).toBe(8);
    expect(pointsForStrength("medium")).toBe(4);
    expect(pointsForStrength("weak")).toBe(2);
    expect(pointsForStrength("non_signal")).toBe(0);
  });

  it("covers every Strength member", () => {
    const all: Strength[] = ["strong", "medium", "weak", "non_signal"];
    for (const s of all) expect(typeof pointsForStrength(s)).toBe("number");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run brain/__tests__/types.test.ts`
Expected: FAIL — cannot resolve `@/brain/types`.

- [ ] **Step 3: Write `brain/types.ts`**

```ts
// UI-facing view model for the brain board. Plain JSON-serializable types
// (no class instances, no functions) so a server component can pass them to a
// client component as props. Decoupled from lib/gems zod schemas on purpose.

export type Strength = "strong" | "medium" | "weak" | "non_signal";
export type Points = 8 | 4 | 2 | 0;
export type Provenance = "gem" | "spec_only";
export type GraphSource = "traced" | "mock";

const STRENGTH_POINTS: Record<Strength, Points> = {
  strong: 8,
  medium: 4,
  weak: 2,
  non_signal: 0,
};

export function pointsForStrength(s: Strength): Points {
  return STRENGTH_POINTS[s];
}

export interface BrainModel {
  categories: CategoryView[];
}

export interface CategoryView {
  id: string;
  name: string;
  version: string;
  status: string;
  dispatchGate: number;
  scoring: { strong: number; medium: number; weak: number; confirmedTp: number };
  rubrics: RubricView[];
}

export interface RubricView {
  id: string;
  name: string;
  description: string;
  severity: string;
  pointsIfStrong: number;
  requiredBoundaries: string[];
  provenance: Provenance;
  signals: SignalView[];
}

export interface SignalView {
  id: string;
  name: string;
  strength: Strength;
  points: Points;
  requiredNodes: string[];
  attackGraph: AttackGraphView; // always present: real traced graph, or generated mock
}

export interface AttackGraphView {
  graphId: string;
  entry: string;
  requiredNodes: string[];
  nodes: AttackNodeView[];
  edges: AttackEdgeView[];
  source: GraphSource;
}

// The 10 node-kinds and 12 edge-relations are the real gem vocabulary.
export type NodeKind =
  | "trigger" | "dispatch" | "http" | "parse" | "deobf" | "sink"
  | "condition" | "benign_branch" | "assessment" | "verdict";

export type EdgeRelation =
  | "calls" | "returns" | "data_to" | "triggers" | "initializes" | "registers"
  | "async_triggers" | "branch_benign" | "branch_uncloaked"
  | "resolves_or_requests" | "destination_to_container" | "loads";

export interface AttackNodeView {
  id: string;
  label: string;
  kind: NodeKind;
  phase: string;
  boundary?: string | null;
  behavioralRole?: string;
  isRequired: boolean;
  staticConfirmed?: boolean;
  fridaHook?: string;
  signature?: { className: string; method: string; filePath: string; line: number; snippet: string };
}

export interface AttackEdgeView {
  from: string;
  to: string;
  relation: EdgeRelation;
  label?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run brain/__tests__/types.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add brain/types.ts brain/__tests__/types.test.ts
git commit -m "feat(brain): view model types + strength→points helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Rubric id-map (name ↔ rubric_id ↔ provenance)

Maps the spreadsheet rubric names to stable `rubric_id`s and records which are gem-backed. Used by both the generator and `loadModel`.

**Files:**
- Create: `brain/data/rubricIdMap.ts`
- Test: `brain/__tests__/rubricIdMap.test.ts`

- [ ] **Step 1: Write the failing test**

Create `brain/__tests__/rubricIdMap.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { RUBRIC_ID_MAP, GEM_RUBRIC_IDS } from "@/brain/data/rubricIdMap";

describe("rubricIdMap", () => {
  it("has all 10 spreadsheet rubrics", () => {
    expect(Object.keys(RUBRIC_ID_MAP)).toHaveLength(10);
  });

  it("marks exactly 5 rubrics as gem-backed", () => {
    const gem = Object.values(RUBRIC_ID_MAP).filter((r) => r.provenance === "gem");
    expect(gem).toHaveLength(5);
    expect(GEM_RUBRIC_IDS).toEqual(
      expect.arrayContaining([
        "attribution_gated_webview_uncloaking",
        "runtime_loading_of_code",
        "arbitrary_obfuscated_url_loading",
        "device_info_cloaking",
        "command_and_control",
      ]),
    );
    expect(GEM_RUBRIC_IDS).toHaveLength(5);
  });

  it("maps MMP cloaking to the attribution rubric id", () => {
    expect(RUBRIC_ID_MAP["MMP cloaking"].id).toBe("attribution_gated_webview_uncloaking");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run brain/__tests__/rubricIdMap.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write `brain/data/rubricIdMap.ts`**

```ts
import type { Provenance } from "@/brain/types";

export interface RubricIdEntry {
  id: string;          // stable rubric_id used across the board
  provenance: Provenance;
}

// Keyed by the exact "Category" cell text in docs/riskware_rubrics_processed.xlsx.
export const RUBRIC_ID_MAP: Record<string, RubricIdEntry> = {
  "MMP cloaking": { id: "attribution_gated_webview_uncloaking", provenance: "gem" },
  "Install Referrer cloaking": { id: "install_referrer_cloaking", provenance: "spec_only" },
  "Runtime loading of code": { id: "runtime_loading_of_code", provenance: "gem" },
  "Geolocation cloaking": { id: "geolocation_cloaking", provenance: "spec_only" },
  "Arbitrary or obfuscated URL loading": { id: "arbitrary_obfuscated_url_loading", provenance: "gem" },
  "Network information cloaking": { id: "network_information_cloaking", provenance: "spec_only" },
  "Device info cloaking": { id: "device_info_cloaking", provenance: "gem" },
  "Time cloaking": { id: "time_cloaking", provenance: "spec_only" },
  "Command And Control": { id: "command_and_control", provenance: "gem" },
  "Partial uncloaking": { id: "partial_uncloaking", provenance: "spec_only" },
};

export const GEM_RUBRIC_IDS: string[] = Object.values(RUBRIC_ID_MAP)
  .filter((r) => r.provenance === "gem")
  .map((r) => r.id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run brain/__tests__/rubricIdMap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add brain/data/rubricIdMap.ts brain/__tests__/rubricIdMap.test.ts
git commit -m "feat(brain): rubric name↔id↔provenance map

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Taxonomy generator script

A dependency-free Node script that reads the `.xlsx` (a zip of XML) via the system `unzip` binary, parses the `Rubric` sheet, and emits `brain/data/riskwareTaxonomy.ts`. Run once; output is committed.

**Files:**
- Create: `scripts/brain-gen-taxonomy.mjs`
- Generates: `brain/data/riskwareTaxonomy.ts`

- [ ] **Step 1: Write the generator**

Create `scripts/brain-gen-taxonomy.mjs`:
```js
#!/usr/bin/env node
// Regenerate brain/data/riskwareTaxonomy.ts from the source-of-truth workbook.
// Dependency-free: shells out to `unzip -p` (xlsx is a zip of XML) and parses
// sharedStrings + the "Rubric" sheet with light regex. Output is committed; the
// taxonomy.test.ts guards counts/tallies regardless of how the file was produced.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const XLSX = "docs/riskware_rubrics_processed.xlsx";
const OUT = "brain/data/riskwareTaxonomy.ts";

function entry(name) {
  return execSync(`unzip -p ${JSON.stringify(XLSX)} ${name}`, {
    encoding: "utf8",
    maxBuffer: 1 << 24,
  });
}

function unescapeXml(s) {
  return s
    .replace(/&#10;/g, "\n")
    .replace(/&#9;/g, "\t")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// sharedStrings: each <si> may hold one <t> or several <r><t> runs.
function sharedStrings() {
  const xml = entry("xl/sharedStrings.xml");
  const out = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml))) {
    const parts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => unescapeXml(x[1]));
    out.push(parts.join(""));
  }
  return out;
}

// Rubric sheet → rows of { A, B, C, D } using shared-string indices.
function rubricRows(ss) {
  const xml = entry("xl/worksheets/sheet1.xml");
  const rows = [];
  for (const rowM of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const cM of rowM[1].matchAll(/<c r="([A-Z]+)\d+"(?:\s+t="([^"]+)")?[^>]*>([\s\S]*?)<\/c>/g)) {
      const col = cM[1];
      const t = cM[2];
      const vM = cM[3].match(/<v>([\s\S]*?)<\/v>/);
      const isM = cM[3].match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
      let val = "";
      if (vM) val = t === "s" ? ss[Number(vM[1])] : vM[1];
      else if (isM) val = unescapeXml(isM[1]);
      cells[col] = val;
    }
    rows.push(cells);
  }
  return rows;
}

const STRENGTH = { Strong: "strong", Medium: "medium", Weak: "weak", "Non-Signal": "non_signal" };

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
}

function main() {
  const ss = sharedStrings();
  const rows = rubricRows(ss).slice(1).filter((r) => r.A && r.A.trim()); // drop header
  // Import the id-map so rubric_ids stay consistent with the app.
  // (Parsed here as a literal to avoid importing TS from a .mjs script.)
  const IDS = {
    "MMP cloaking": "attribution_gated_webview_uncloaking",
    "Install Referrer cloaking": "install_referrer_cloaking",
    "Runtime loading of code": "runtime_loading_of_code",
    "Geolocation cloaking": "geolocation_cloaking",
    "Arbitrary or obfuscated URL loading": "arbitrary_obfuscated_url_loading",
    "Network information cloaking": "network_information_cloaking",
    "Device info cloaking": "device_info_cloaking",
    "Time cloaking": "time_cloaking",
    "Command And Control": "command_and_control",
    "Partial uncloaking": "partial_uncloaking",
  };

  const byRubric = new Map();
  for (const r of rows) {
    const name = r.A.trim();
    const id = IDS[name];
    if (!id) throw new Error(`Unknown rubric in sheet: "${name}" — update rubricIdMap.`);
    if (!byRubric.has(id)) {
      byRubric.set(id, { id, name, description: (r.B || "").trim(), signals: [] });
    }
    const strength = STRENGTH[(r.D || "").trim()];
    if (!strength) throw new Error(`Unknown strength "${r.D}" for signal "${r.C}"`);
    const sigName = (r.C || "").trim();
    byRubric.get(id).signals.push({
      id: `${id}__${slug(sigName)}`,
      name: sigName,
      strength,
    });
  }

  const rubrics = [...byRubric.values()];
  const totalSignals = rubrics.reduce((n, r) => n + r.signals.length, 0);

  const banner =
    "// GENERATED by scripts/brain-gen-taxonomy.mjs from docs/riskware_rubrics_processed.xlsx.\n" +
    "// Do not hand-edit. Regenerate with: node scripts/brain-gen-taxonomy.mjs\n";
  const body =
    banner +
    'import type { Strength } from "@/brain/types";\n\n' +
    "export interface TaxonomySignal { id: string; name: string; strength: Strength }\n" +
    "export interface TaxonomyRubric { id: string; name: string; description: string; signals: TaxonomySignal[] }\n\n" +
    `export const RISKWARE_TAXONOMY: TaxonomyRubric[] = ${JSON.stringify(rubrics, null, 2)};\n\n` +
    `export const TAXONOMY_RUBRIC_COUNT = ${rubrics.length};\n` +
    `export const TAXONOMY_SIGNAL_COUNT = ${totalSignals};\n`;

  writeFileSync(path.resolve(OUT), body);
  console.log(`Wrote ${OUT}: ${rubrics.length} rubrics, ${totalSignals} signals.`);
}

main();
```

- [ ] **Step 2: Run the generator**

Run: `node scripts/brain-gen-taxonomy.mjs`
Expected: prints `Wrote brain/data/riskwareTaxonomy.ts: 10 rubrics, 44 signals.` and creates the file.

- [ ] **Step 3: Eyeball the generated file**

Run: `grep -c '"strength"' brain/data/riskwareTaxonomy.ts`
Expected: `44`.

Run: `head -20 brain/data/riskwareTaxonomy.ts`
Expected: the GENERATED banner, the type exports, and the start of `RISKWARE_TAXONOMY`.

- [ ] **Step 4: Type-check the generated file**

Run: `npm run typecheck`
Expected: PASS (the generated TS imports only `Strength` from `@/brain/types`).

- [ ] **Step 5: Commit**

```bash
git add scripts/brain-gen-taxonomy.mjs brain/data/riskwareTaxonomy.ts
git commit -m "feat(brain): taxonomy generator + generated riskware taxonomy (10 rubrics/44 signals)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Taxonomy correctness test

Locks the generated taxonomy to the Summary-sheet totals (10 rubrics, 44 signals, S/M/W/NS = 13/11/19/1) so a bad regeneration fails loudly.

**Files:**
- Test: `brain/__tests__/taxonomy.test.ts`

- [ ] **Step 1: Write the test**

Create `brain/__tests__/taxonomy.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  RISKWARE_TAXONOMY,
  TAXONOMY_RUBRIC_COUNT,
  TAXONOMY_SIGNAL_COUNT,
} from "@/brain/data/riskwareTaxonomy";
import type { Strength } from "@/brain/types";

describe("riskware taxonomy", () => {
  it("has 10 rubrics and 44 signals", () => {
    expect(TAXONOMY_RUBRIC_COUNT).toBe(10);
    expect(RISKWARE_TAXONOMY).toHaveLength(10);
    expect(TAXONOMY_SIGNAL_COUNT).toBe(44);
    const total = RISKWARE_TAXONOMY.reduce((n, r) => n + r.signals.length, 0);
    expect(total).toBe(44);
  });

  it("matches the Summary-sheet strength tallies", () => {
    const tally: Record<Strength, number> = { strong: 0, medium: 0, weak: 0, non_signal: 0 };
    for (const r of RISKWARE_TAXONOMY) for (const s of r.signals) tally[s.strength]++;
    expect(tally).toEqual({ strong: 13, medium: 11, weak: 19, non_signal: 1 });
  });

  it("has unique signal ids and non-empty names", () => {
    const ids = RISKWARE_TAXONOMY.flatMap((r) => r.signals.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RISKWARE_TAXONOMY)
      for (const s of r.signals) expect(s.name.length).toBeGreaterThan(0);
  });

  it("has the expected per-rubric signal counts", () => {
    const counts = Object.fromEntries(RISKWARE_TAXONOMY.map((r) => [r.id, r.signals.length]));
    expect(counts).toMatchObject({
      attribution_gated_webview_uncloaking: 5,
      install_referrer_cloaking: 1,
      runtime_loading_of_code: 5,
      geolocation_cloaking: 6,
      arbitrary_obfuscated_url_loading: 10,
      network_information_cloaking: 5,
      device_info_cloaking: 9,
      time_cloaking: 1,
      command_and_control: 1,
      partial_uncloaking: 1,
    });
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run brain/__tests__/taxonomy.test.ts`
Expected: PASS (all 4). If any fail, the generator output is wrong — fix `scripts/brain-gen-taxonomy.mjs`, regenerate, re-run.

- [ ] **Step 3: Commit**

```bash
git add brain/__tests__/taxonomy.test.ts
git commit -m "test(brain): lock taxonomy to spreadsheet totals (10/44, 13/11/19/1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Gem ↔ spreadsheet consistency test

Asserts the 5 gem-backed rubrics' real `chains.yaml` (signal names + strengths) match the taxonomy — catches drift between the product gems and the source-of-truth spreadsheet.

**Files:**
- Test: `brain/__tests__/gemConsistency.test.ts`

- [ ] **Step 1: Write the test**

Create `brain/__tests__/gemConsistency.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { RISKWARE_TAXONOMY } from "@/brain/data/riskwareTaxonomy";
import { GEM_RUBRIC_IDS } from "@/brain/data/rubricIdMap";
import { loadChains } from "@/lib/gems/loadGem";

// normalize: compare the SET of (name, strength) pairs, order-independent.
function pairKey(name: string, strength: string) {
  return `${name.trim()}::${strength}`;
}

describe("gem ↔ spreadsheet consistency", () => {
  for (const rubricId of GEM_RUBRIC_IDS) {
    it(`${rubricId}: gem chains.yaml matches the taxonomy`, () => {
      const taxon = RISKWARE_TAXONOMY.find((r) => r.id === rubricId);
      expect(taxon, `taxonomy missing ${rubricId}`).toBeDefined();

      const gemChains = loadChains(rubricId).chains;
      const gemSet = new Set(gemChains.map((c) => pairKey(c.name, c.strength)));
      const taxonSet = new Set(taxon!.signals.map((s) => pairKey(s.name, s.strength)));

      expect(gemChains.length).toBe(taxon!.signals.length);
      expect([...gemSet].sort()).toEqual([...taxonSet].sort());
    });
  }
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run brain/__tests__/gemConsistency.test.ts`
Expected: PASS (5 cases). If a case fails, the gem and spreadsheet disagree — report the diff; do NOT edit gems to force a pass (gems are product source-of-truth; the discrepancy is a finding).

- [ ] **Step 3: Commit**

```bash
git add brain/__tests__/gemConsistency.test.ts
git commit -m "test(brain): guard gem chains vs taxonomy (no drift)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Palette (kind/relation/strength styling)

Centralized Tailwind class maps mirroring `components/CallGraph.tsx` `RELATION_TONE` for brand consistency. Pure data; a test asserts total coverage of every kind/relation/strength.

**Files:**
- Create: `brain/palette.ts`
- Test: `brain/__tests__/palette.test.ts`

- [ ] **Step 1: Write the failing test**

Create `brain/__tests__/palette.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { KIND_STYLE, RELATION_TONE, STRENGTH_CHIP } from "@/brain/palette";

const KINDS = ["trigger","dispatch","http","parse","deobf","sink","condition","benign_branch","assessment","verdict"];
const RELATIONS = ["calls","returns","data_to","triggers","initializes","registers","async_triggers","branch_benign","branch_uncloaked","resolves_or_requests","destination_to_container","loads"];
const STRENGTHS = ["strong","medium","weak","non_signal"];

describe("palette", () => {
  it("styles every node kind", () => {
    for (const k of KINDS) expect(KIND_STYLE[k as keyof typeof KIND_STYLE]).toBeTruthy();
    expect(Object.keys(KIND_STYLE)).toHaveLength(10);
  });
  it("tones every edge relation", () => {
    for (const r of RELATIONS) expect(RELATION_TONE[r as keyof typeof RELATION_TONE]).toBeTruthy();
    expect(Object.keys(RELATION_TONE)).toHaveLength(12);
  });
  it("chips every strength", () => {
    for (const s of STRENGTHS) expect(STRENGTH_CHIP[s as keyof typeof STRENGTH_CHIP]).toBeTruthy();
    expect(Object.keys(STRENGTH_CHIP)).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run brain/__tests__/palette.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `brain/palette.ts`**

```ts
import type { NodeKind, EdgeRelation, Strength } from "@/brain/types";

// Border + text tone per node kind (Tailwind classes; tokens from app/globals.css).
export const KIND_STYLE: Record<NodeKind, string> = {
  trigger: "border-accent-green/50 text-accent-green",
  dispatch: "border-accent-cyan/50 text-accent-cyan",
  http: "border-accent-amber/50 text-accent-amber",
  parse: "border-accent-amber/50 text-accent-amber",
  deobf: "border-accent-violet/50 text-accent-violet",
  sink: "border-rose-400/60 text-rose-300",
  condition: "border-yellow-400/60 text-yellow-300",
  benign_branch: "border-emerald-400/50 text-emerald-300",
  assessment: "border-accent-cyan/40 text-accent-cyan",
  verdict: "border-fuchsia-400/60 text-fuchsia-300",
};

// Mirrors components/CallGraph.tsx RELATION_TONE.
export const RELATION_TONE: Record<EdgeRelation, string> = {
  calls: "text-accent-cyan",
  returns: "text-accent-violet",
  data_to: "text-accent-amber",
  triggers: "text-accent-green",
  initializes: "text-accent-cyan",
  registers: "text-accent-cyan",
  async_triggers: "text-accent-green",
  branch_benign: "text-emerald-400",
  branch_uncloaked: "text-rose-400",
  resolves_or_requests: "text-accent-amber",
  destination_to_container: "text-accent-violet",
  loads: "text-accent-violet",
};

// Strength chip styling for signal nodes.
export const STRENGTH_CHIP: Record<Strength, string> = {
  strong: "bg-rose-500/15 text-rose-300 border-rose-400/40",
  medium: "bg-amber-500/15 text-amber-300 border-amber-400/40",
  weak: "bg-sky-500/15 text-sky-300 border-sky-400/40",
  non_signal: "bg-zinc-500/15 text-zinc-400 border-zinc-400/30",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run brain/__tests__/palette.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add brain/palette.ts brain/__tests__/palette.test.ts
git commit -m "feat(brain): palette for kinds/relations/strengths

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Mock attack-graph generator

> **DESIGN LATITUDE — optional hands-on contribution.** The shape of a believable
> placeholder graph is a real design choice (see spec §5). The implementation
> below is a sound default. A contributor may refine the node-shaping heuristic in
> `buildMockNodes` (e.g. richer phase names, more kinds per rubric family) as long
> as the tests in Task 8 keep passing.

Deterministic (seeded off `chain_id`, no randomness): a signal + its rubric → a small `AttackGraphView` using only the real node-kinds/relations, flagged `source: "mock"`.

**Files:**
- Create: `brain/transform/mockGraph.ts`
- Test: `brain/__tests__/mockGraph.test.ts`

- [ ] **Step 1: Write the failing test**

Create `brain/__tests__/mockGraph.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mockGraph } from "@/brain/transform/mockGraph";
import type { NodeKind, EdgeRelation } from "@/brain/types";

const KINDS: NodeKind[] = ["trigger","dispatch","http","parse","deobf","sink","condition","benign_branch","assessment","verdict"];
const RELATIONS: EdgeRelation[] = ["calls","returns","data_to","triggers","initializes","registers","async_triggers","branch_benign","branch_uncloaked","resolves_or_requests","destination_to_container","loads"];

const sig = (id: string, strength: any = "strong") => ({ id, name: "n", strength, points: 8 as const });
const rub = (boundaries: string[] = []) => ({ requiredBoundaries: boundaries });

describe("mockGraph", () => {
  it("is flagged as a mock and references the chain id", () => {
    const g = mockGraph(sig("rubric__sig_a"), rub());
    expect(g.source).toBe("mock");
    expect(g.graphId).toContain("rubric__sig_a");
  });

  it("emits only valid node-kinds and edge-relations", () => {
    const g = mockGraph(sig("x__y"), rub(["acquisition", "gate", "sink"]));
    for (const n of g.nodes) expect(KINDS).toContain(n.kind);
    for (const e of g.edges) expect(RELATIONS).toContain(e.relation);
  });

  it("is deterministic for the same chain id", () => {
    const a = mockGraph(sig("dup__id"), rub(["a", "b"]));
    const b = mockGraph(sig("dup__id"), rub(["a", "b"]));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("entry points to a real node and edges connect real nodes", () => {
    const g = mockGraph(sig("z__z"), rub(["one", "two", "three"]));
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(ids.has(g.entry)).toBe(true);
    for (const e of g.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  it("marks at least one required node and lacks signatures", () => {
    const g = mockGraph(sig("a__b"), rub(["acq", "sink"]));
    expect(g.nodes.some((n) => n.isRequired)).toBe(true);
    expect(g.requiredNodes.length).toBeGreaterThan(0);
    for (const n of g.nodes) expect(n.signature).toBeUndefined();
  });

  it("scales node count with strength", () => {
    const strong = mockGraph(sig("s1", "strong"), rub());
    const weak = mockGraph(sig("s2", "weak"), rub());
    expect(strong.nodes.length).toBeGreaterThanOrEqual(weak.nodes.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run brain/__tests__/mockGraph.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `brain/transform/mockGraph.ts`**

```ts
import type { AttackGraphView, AttackNodeView, AttackEdgeView, NodeKind, Strength } from "@/brain/types";

interface SigLike { id: string; name: string; strength: Strength }
interface RubLike { requiredBoundaries: string[] }

// node count by strength — strong flows are richer than supporting ones.
const NODES_BY_STRENGTH: Record<Strength, number> = { strong: 5, medium: 4, weak: 3, non_signal: 2 };

// a plausible kind progression for a generic uncloaking/loading flow.
const SKELETON_KINDS: NodeKind[] = ["trigger", "dispatch", "condition", "deobf", "sink"];

function kindForIndex(i: number, total: number): NodeKind {
  if (i === 0) return "trigger";
  if (i === total - 1) return "sink";
  return SKELETON_KINDS[Math.min(i, SKELETON_KINDS.length - 2)] ?? "dispatch";
}

// Build nodes: one per required boundary when present, else a strength-scaled skeleton.
function buildMockNodes(sig: SigLike, rub: RubLike): AttackNodeView[] {
  const phases = rub.requiredBoundaries.length
    ? rub.requiredBoundaries
    : Array.from({ length: NODES_BY_STRENGTH[sig.strength] }, (_, i) => `stage_${i + 1}`);

  const total = phases.length;
  return phases.map((phase, i) => {
    const kind = kindForIndex(i, total);
    // required = the gate-like condition and the terminal sink (the scoring boundaries).
    const isRequired = kind === "condition" || kind === "sink" || (total <= 2 && i === total - 1);
    return {
      id: `${sig.id}__n${i + 1}`,
      label: `${phase} (mock)`,
      kind,
      phase,
      boundary: rub.requiredBoundaries.length ? phase : null,
      isRequired,
    };
  });
}

export function mockGraph(sig: SigLike, rub: RubLike): AttackGraphView {
  const nodes = buildMockNodes(sig, rub);
  const edges: AttackEdgeView[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const next = nodes[i + 1];
    const relation = next.kind === "sink" ? "loads"
      : next.kind === "condition" ? "branch_uncloaked"
      : next.kind === "deobf" ? "data_to"
      : "calls";
    edges.push({ from: nodes[i].id, to: next.id, relation });
  }
  const requiredNodes = nodes.filter((n) => n.isRequired).map((n) => n.id);
  // guarantee at least one required node (the terminal) for degenerate flows.
  if (requiredNodes.length === 0 && nodes.length) {
    nodes[nodes.length - 1].isRequired = true;
    requiredNodes.push(nodes[nodes.length - 1].id);
  }
  return {
    graphId: `mock__${sig.id}`,
    entry: nodes[0]?.id ?? `${sig.id}__n1`,
    requiredNodes,
    nodes,
    edges,
    source: "mock",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run brain/__tests__/mockGraph.test.ts`
Expected: PASS (all 6).

- [ ] **Step 5: Commit**

```bash
git add brain/transform/mockGraph.ts brain/__tests__/mockGraph.test.ts
git commit -m "feat(brain): deterministic mock attack-graph generator

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `loadModel` adapter (server-only)

Assembles the full `BrainModel`: category shell from the gem + 10 rubrics/44 signals from the taxonomy + the 1 real traced graph + 43 mocks + provenance.

**Files:**
- Create: `brain/adapter/loadModel.ts`
- Test: `brain/__tests__/loadModel.test.ts`

- [ ] **Step 1: Write the failing test**

Create `brain/__tests__/loadModel.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { loadModel } from "@/brain/adapter/loadModel";

describe("loadModel", () => {
  const model = loadModel();
  const cat = model.categories[0];

  it("has one riskware category with the gem scoring/gate", () => {
    expect(model.categories).toHaveLength(1);
    expect(cat.id).toBe("riskware");
    expect(cat.dispatchGate).toBe(8);
    expect(cat.scoring.strong).toBe(8);
  });

  it("has 10 rubrics and 44 signals", () => {
    expect(cat.rubrics).toHaveLength(10);
    const signals = cat.rubrics.reduce((n, r) => n + r.signals.length, 0);
    expect(signals).toBe(44);
  });

  it("flags 5 gem and 5 spec_only rubrics", () => {
    expect(cat.rubrics.filter((r) => r.provenance === "gem")).toHaveLength(5);
    expect(cat.rubrics.filter((r) => r.provenance === "spec_only")).toHaveLength(5);
  });

  it("attaches exactly one traced graph and 43 mocks", () => {
    const all = cat.rubrics.flatMap((r) => r.signals);
    expect(all.filter((s) => s.attackGraph.source === "traced")).toHaveLength(1);
    expect(all.filter((s) => s.attackGraph.source === "mock")).toHaveLength(43);
  });

  it("the traced graph is the MMP strong-8 chain with real signatures", () => {
    const mmp = cat.rubrics.find((r) => r.id === "attribution_gated_webview_uncloaking")!;
    const traced = mmp.signals.find((s) => s.attackGraph.source === "traced")!;
    expect(traced.attackGraph.nodes.length).toBeGreaterThanOrEqual(10);
    expect(traced.attackGraph.nodes.some((n) => n.signature)).toBe(true);
  });

  it("every signal has a graph whose edges connect real nodes", () => {
    for (const r of cat.rubrics)
      for (const s of r.signals) {
        const ids = new Set(s.attackGraph.nodes.map((n) => n.id));
        expect(ids.has(s.attackGraph.entry)).toBe(true);
        for (const e of s.attackGraph.edges) {
          expect(ids.has(e.from)).toBe(true);
          expect(ids.has(e.to)).toBe(true);
        }
      }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run brain/__tests__/loadModel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `brain/adapter/loadModel.ts`**

Note on the traced graph: the existing `loadGraphGem("attribution_gated_webview_uncloaking")` returns a `GraphGem` (see `lib/gems/types.ts`). Map its nodes/edges into `AttackGraphView`. The gem's `required_nodes` populate `isRequired`. `loadCategory("riskware")` provides the gate + scoring model.

```ts
import "server-only";
import { loadCategory, loadGraphGem } from "@/lib/gems/loadGem";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { RISKWARE_TAXONOMY } from "@/brain/data/riskwareTaxonomy";
import { RUBRIC_ID_MAP } from "@/brain/data/rubricIdMap";
import { mockGraph } from "@/brain/transform/mockGraph";
import { pointsForStrength } from "@/brain/types";
import type {
  BrainModel, CategoryView, RubricView, SignalView,
  AttackGraphView, AttackNodeView, AttackEdgeView, NodeKind, EdgeRelation,
} from "@/brain/types";
import type { GraphGem } from "@/lib/gems/types";

const GEMS = path.join(process.cwd(), "gems");

// Which traced graphs exist today, keyed by rubric_id → the chain they belong to.
const TRACED: Record<string, { chainName: string }> = {
  attribution_gated_webview_uncloaking: {
    chainName: "App loads affiliate link into a Webview w/ conversion data",
  },
};

interface RubricYaml {
  name?: string;
  description?: string;
  severity?: string;
  required_behavioral_boundaries?: string[];
}

function readRubricYaml(rubricId: string): RubricYaml | undefined {
  try {
    return parse(readFileSync(path.join(GEMS, `riskware/rubrics/${rubricId}/rubric.yaml`), "utf8")) as RubricYaml;
  } catch {
    return undefined;
  }
}

function gemToAttackGraph(gem: GraphGem): AttackGraphView {
  const required = new Set(gem.required_nodes);
  const nodes: AttackNodeView[] = gem.nodes.map((n) => ({
    id: n.node_id,
    label: n.label,
    kind: n.kind as NodeKind,
    phase: n.phase,
    boundary: n.boundary ?? null,
    behavioralRole: n.behavioral_role,
    isRequired: required.has(n.node_id),
    staticConfirmed: n.static_confirmed,
    fridaHook: n.frida_hook,
    signature: {
      className: n.signature.class_name,
      method: n.signature.method,
      filePath: n.signature.file_path,
      line: n.signature.line,
      snippet: n.signature.snippet,
    },
  }));
  const edges: AttackEdgeView[] = gem.edges.map((e) => ({
    from: e.from,
    to: e.to,
    relation: e.relation as EdgeRelation,
    label: e.label,
  }));
  return { graphId: gem.graph_id, entry: gem.entry, requiredNodes: gem.required_nodes, nodes, edges, source: "traced" };
}

// Derive a severity for spec_only rubrics from their strongest signal.
function deriveSeverity(strengths: string[]): string {
  if (strengths.includes("strong")) return "high";
  if (strengths.includes("medium")) return "medium";
  return "low";
}

export function loadModel(): BrainModel {
  const gemCat = loadCategory("riskware");

  // Pre-load the one traced graph once.
  const tracedGem = loadGraphGem("attribution_gated_webview_uncloaking");
  const tracedView = gemToAttackGraph(tracedGem);

  const rubrics: RubricView[] = RISKWARE_TAXONOMY.map((tr) => {
    const idEntry = Object.values(RUBRIC_ID_MAP).find((r) => r.id === tr.id)!;
    const provenance = idEntry.provenance;
    const ry = provenance === "gem" ? readRubricYaml(tr.id) : undefined;
    const requiredBoundaries = ry?.required_behavioral_boundaries ?? [];

    const signals: SignalView[] = tr.signals.map((s) => {
      const traced = TRACED[tr.id]?.chainName === s.name;
      const attackGraph: AttackGraphView = traced
        ? tracedView
        : mockGraph({ id: s.id, name: s.name, strength: s.strength }, { requiredBoundaries });
      return {
        id: s.id,
        name: s.name,
        strength: s.strength,
        points: pointsForStrength(s.strength),
        requiredNodes: attackGraph.requiredNodes,
        attackGraph,
      };
    });

    return {
      id: tr.id,
      name: ry?.name ?? tr.name,
      description: ry?.description ?? tr.description,
      severity: ry?.severity?.split(/\s+/)[0] ?? deriveSeverity(tr.signals.map((s) => s.strength)),
      pointsIfStrong: 8,
      requiredBoundaries,
      provenance,
      signals,
    };
  });

  const category: CategoryView = {
    id: gemCat.category_id,
    name: gemCat.name,
    version: gemCat.version,
    status: gemCat.status,
    dispatchGate: gemCat.dispatch_gate.metadata_score_gte,
    scoring: {
      strong: gemCat.scoring_model.strong,
      medium: gemCat.scoring_model.medium,
      weak: gemCat.scoring_model.weak,
      confirmedTp: gemCat.scoring_model.confirmed_tp_threshold,
    },
    rubrics,
  };

  return { categories: [category] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run brain/__tests__/loadModel.test.ts`
Expected: PASS (all 6). If the `severity` for `device_info_cloaking` includes a trailing comment, the `.split(/\s+/)[0]` handles it (`"medium"`).

- [ ] **Step 5: Type-check & commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add brain/adapter/loadModel.ts brain/__tests__/loadModel.test.ts
git commit -m "feat(brain): server-only loadModel — taxonomy + traced gem + mocks → BrainModel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `layout.ts` — dagre auto-layout helper

Assigns x/y to React Flow nodes. Pure (given fixed node sizes); tested for deterministic, non-overlapping placement.

**Files:**
- Create: `brain/transform/layout.ts`
- Test: `brain/__tests__/layout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `brain/__tests__/layout.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { layoutGraph } from "@/brain/transform/layout";

const nodes = [
  { id: "a", type: "x", data: {}, position: { x: 0, y: 0 } },
  { id: "b", type: "x", data: {}, position: { x: 0, y: 0 } },
  { id: "c", type: "x", data: {}, position: { x: 0, y: 0 } },
];
const edges = [
  { id: "a-b", source: "a", target: "b" },
  { id: "b-c", source: "b", target: "c" },
];

describe("layoutGraph", () => {
  it("assigns distinct positions to every node", () => {
    const out = layoutGraph(nodes as any, edges as any, "TB");
    const ys = out.map((n) => n.position.y);
    expect(new Set(out.map((n) => `${n.position.x},${n.position.y}`)).size).toBe(3);
    expect(Math.max(...ys)).toBeGreaterThan(Math.min(...ys)); // ranked vertically
  });

  it("is deterministic", () => {
    const a = layoutGraph(nodes as any, edges as any, "LR");
    const b = layoutGraph(nodes as any, edges as any, "LR");
    expect(a.map((n) => n.position)).toEqual(b.map((n) => n.position));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run brain/__tests__/layout.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `brain/transform/layout.ts`**

```ts
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

const NODE_W = 240;
const NODE_H = 120;

export type Direction = "TB" | "LR";

// Position React Flow nodes with dagre. Returns new node objects (pure-ish:
// same input always yields the same output).
export function layoutGraph<T extends Node>(nodes: T[], edges: Edge[], direction: Direction = "TB"): T[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 80, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    const w = (n.width as number | undefined) ?? NODE_W;
    const h = (n.height as number | undefined) ?? NODE_H;
    g.setNode(n.id, { width: w, height: h });
  }
  for (const e of edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    return {
      ...n,
      position: { x: p.x - p.width / 2, y: p.y - p.height / 2 },
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run brain/__tests__/layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add brain/transform/layout.ts brain/__tests__/layout.test.ts
git commit -m "feat(brain): dagre auto-layout helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: `toClusterGraph` (Layer 1 builder)

Turns the `BrainModel` into React Flow nodes/edges for the Category → Rubric → Signal cluster map.

**Files:**
- Create: `brain/transform/toClusterGraph.ts`
- Test: `brain/__tests__/toClusterGraph.test.ts`

- [ ] **Step 1: Write the failing test**

Create `brain/__tests__/toClusterGraph.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toClusterGraph } from "@/brain/transform/toClusterGraph";
import { loadModel } from "@/brain/adapter/loadModel";

describe("toClusterGraph", () => {
  const { nodes, edges } = toClusterGraph(loadModel());

  it("emits 1 category + 10 rubric + 44 signal nodes", () => {
    const byType = (t: string) => nodes.filter((n) => n.type === t).length;
    expect(byType("category")).toBe(1);
    expect(byType("rubric")).toBe(10);
    expect(byType("signal")).toBe(44);
    expect(nodes).toHaveLength(55);
  });

  it("wires category→rubric (10) and rubric→signal (44) edges", () => {
    expect(edges).toHaveLength(54);
    for (const e of edges) {
      expect(nodes.some((n) => n.id === e.source)).toBe(true);
      expect(nodes.some((n) => n.id === e.target)).toBe(true);
    }
  });

  it("carries provenance on rubric nodes and source on signal nodes", () => {
    const rubric = nodes.find((n) => n.type === "rubric")!;
    expect(["gem", "spec_only"]).toContain((rubric.data as any).provenance);
    const signal = nodes.find((n) => n.type === "signal")!;
    expect(["traced", "mock"]).toContain((signal.data as any).graphSource);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run brain/__tests__/toClusterGraph.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `brain/transform/toClusterGraph.ts`**

```ts
import type { Node, Edge } from "@xyflow/react";
import type { BrainModel } from "@/brain/types";
import { layoutGraph } from "@/brain/transform/layout";

export function toClusterGraph(model: BrainModel): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  for (const cat of model.categories) {
    const catId = `cat:${cat.id}`;
    nodes.push({
      id: catId,
      type: "category",
      position: { x: 0, y: 0 },
      data: {
        name: cat.name,
        version: cat.version,
        status: cat.status,
        dispatchGate: cat.dispatchGate,
        scoring: cat.scoring,
        rubricCount: cat.rubrics.length,
      },
    });

    for (const rub of cat.rubrics) {
      const rubId = `rub:${rub.id}`;
      const tracedCount = rub.signals.filter((s) => s.attackGraph.source === "traced").length;
      nodes.push({
        id: rubId,
        type: "rubric",
        position: { x: 0, y: 0 },
        data: {
          rubricId: rub.id,
          name: rub.name,
          severity: rub.severity,
          pointsIfStrong: rub.pointsIfStrong,
          requiredBoundaries: rub.requiredBoundaries,
          signalCount: rub.signals.length,
          provenance: rub.provenance,
          hasTraced: tracedCount > 0,
        },
      });
      edges.push({ id: `${catId}->${rubId}`, source: catId, target: rubId, label: "contains" });

      for (const sig of rub.signals) {
        const sigId = `sig:${sig.id}`;
        nodes.push({
          id: sigId,
          type: "signal",
          position: { x: 0, y: 0 },
          data: {
            signalId: sig.id,
            name: sig.name,
            strength: sig.strength,
            points: sig.points,
            requiredNodeCount: sig.requiredNodes.length,
            graphSource: sig.attackGraph.source,
          },
        });
        edges.push({ id: `${rubId}->${sigId}`, source: rubId, target: sigId });
      }
    }
  }

  return { nodes: layoutGraph(nodes, edges, "LR"), edges };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run brain/__tests__/toClusterGraph.test.ts`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add brain/transform/toClusterGraph.ts brain/__tests__/toClusterGraph.test.ts
git commit -m "feat(brain): cluster-graph builder (Layer 1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: `toAttackGraph` (Layer 2 builder)

Turns one `AttackGraphView` into React Flow nodes/edges, preserving required flags, relation tones, and signature payloads.

**Files:**
- Create: `brain/transform/toAttackGraph.ts`
- Test: `brain/__tests__/toAttackGraph.test.ts`

- [ ] **Step 1: Write the failing test**

Create `brain/__tests__/toAttackGraph.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toAttackGraph } from "@/brain/transform/toAttackGraph";
import type { AttackGraphView } from "@/brain/types";

const g: AttackGraphView = {
  graphId: "g1",
  entry: "n1",
  requiredNodes: ["n2"],
  source: "traced",
  nodes: [
    { id: "n1", label: "Launch", kind: "trigger", phase: "p1", isRequired: false },
    { id: "n2", label: "Gate", kind: "condition", phase: "p2", isRequired: true,
      signature: { className: "C", method: "m()", filePath: "f.java", line: 9, snippet: "x" } },
  ],
  edges: [{ from: "n1", to: "n2", relation: "branch_uncloaked", label: "status==NonOrg" }],
};

describe("toAttackGraph", () => {
  const { nodes, edges } = toAttackGraph(g);

  it("preserves node + edge counts", () => {
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(1);
  });

  it("marks required nodes and carries the signature", () => {
    const n2 = nodes.find((n) => n.id === "n2")!;
    expect((n2.data as any).isRequired).toBe(true);
    expect((n2.data as any).signature.line).toBe(9);
  });

  it("preserves relation + label on edges", () => {
    expect((edges[0] as any).label).toBe("status==NonOrg");
    expect((edges[0].data as any).relation).toBe("branch_uncloaked");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run brain/__tests__/toAttackGraph.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `brain/transform/toAttackGraph.ts`**

```ts
import type { Node, Edge } from "@xyflow/react";
import type { AttackGraphView } from "@/brain/types";
import { layoutGraph } from "@/brain/transform/layout";

export function toAttackGraph(graph: AttackGraphView): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map((n) => ({
    id: n.id,
    type: "attack",
    position: { x: 0, y: 0 },
    data: {
      label: n.label,
      kind: n.kind,
      phase: n.phase,
      boundary: n.boundary ?? null,
      behavioralRole: n.behavioralRole,
      isRequired: n.isRequired,
      staticConfirmed: n.staticConfirmed,
      fridaHook: n.fridaHook,
      signature: n.signature,
      isEntry: n.id === graph.entry,
      mock: graph.source === "mock",
    },
  }));

  const edges: Edge[] = graph.edges.map((e, i) => ({
    id: `e${i}:${e.from}->${e.to}`,
    source: e.from,
    target: e.to,
    label: e.label ?? e.relation,
    data: { relation: e.relation },
  }));

  return { nodes: layoutGraph(nodes, edges, "TB"), edges };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run brain/__tests__/toAttackGraph.test.ts`
Expected: PASS (all 3).

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npm run test && npm run typecheck`
Expected: all green (every `brain/` test + existing tests).

- [ ] **Step 6: Commit**

```bash
git add brain/transform/toAttackGraph.ts brain/__tests__/toAttackGraph.test.ts
git commit -m "feat(brain): attack-graph builder (Layer 2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Standalone route shell + placeholder board

Gets `/brain` rendering end-to-end (server loads model → client board prints counts). Verifies the server/client boundary and React Flow CSS before building rich nodes.

**Files:**
- Create: `app/brain/layout.tsx`
- Create: `app/brain/page.tsx`
- Create: `brain/components/BrainBoard.tsx`

- [ ] **Step 1: Write `app/brain/layout.tsx`**

```tsx
import type { ReactNode } from "react";

// Standalone, full-bleed shell — deliberately NOT importing TopNav. This window
// is reached only by navigating to /brain and is invisible from the product tabs.
export default function BrainLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen w-screen bg-bg-base text-zinc-100">{children}</div>;
}
```

- [ ] **Step 2: Write `app/brain/page.tsx`**

```tsx
import { loadModel } from "@/brain/adapter/loadModel";
import { BrainBoard } from "@/brain/components/BrainBoard";

// Server component: read gems/taxonomy on the server, hand a plain-JSON model to
// the client board. force-dynamic keeps it simple (no caching of fs reads).
export const dynamic = "force-dynamic";

export default function BrainPage() {
  const model = loadModel();
  return <BrainBoard model={model} />;
}
```

- [ ] **Step 3: Write a placeholder `brain/components/BrainBoard.tsx`**

```tsx
"use client";

import type { BrainModel } from "@/brain/types";

export function BrainBoard({ model }: { model: BrainModel }) {
  const cat = model.categories[0];
  const signals = cat.rubrics.reduce((n, r) => n + r.signals.length, 0);
  const traced = cat.rubrics.flatMap((r) => r.signals).filter((s) => s.attackGraph.source === "traced").length;
  return (
    <div className="p-8 font-mono text-sm">
      <h1 className="mb-4 text-lg text-accent-cyan">brain · family clustering</h1>
      <p>category: {cat.name}</p>
      <p>rubrics: {cat.rubrics.length} · signals: {signals}</p>
      <p>traced graphs: {traced} · mock graphs: {signals - traced}</p>
    </div>
  );
}
```

- [ ] **Step 4: Start the dev server and verify**

Run (background): `npm run dev`
Then open `http://localhost:3000/brain`.
Expected: page shows `category: Riskware Category Gem`, `rubrics: 10 · signals: 44`, `traced graphs: 1 · mock graphs: 43`. No console errors. Confirm `/` and other product routes still render and that `/brain` is NOT linked from `TopNav`.

- [ ] **Step 5: Commit**

```bash
git add app/brain/layout.tsx app/brain/page.tsx brain/components/BrainBoard.tsx
git commit -m "feat(brain): /brain route shell + server→client model wiring

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Cluster canvas + custom nodes (Layer 1 UI)

Replaces the placeholder body with the React Flow cluster map. Custom Category/Rubric/Signal nodes; clicking a signal drills to Layer 2 (wired in Task 16).

**Files:**
- Create: `brain/components/nodes/CategoryNode.tsx`
- Create: `brain/components/nodes/RubricNode.tsx`
- Create: `brain/components/nodes/SignalNode.tsx`
- Create: `brain/components/ClusterCanvas.tsx`

- [ ] **Step 1: Write `brain/components/nodes/CategoryNode.tsx`**

```tsx
import { Handle, Position } from "@xyflow/react";

export function CategoryNode({ data }: { data: any }) {
  return (
    <div className="w-[240px] rounded-xl border border-accent-cyan/60 bg-bg-elevated/90 p-3 shadow-lg">
      <div className="text-[10px] uppercase tracking-wider text-accent-cyan">category</div>
      <div className="text-sm font-semibold">{data.name}</div>
      <div className="mt-1 text-[11px] text-zinc-400">v{data.version} · {data.status}</div>
      <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[10px] text-zinc-300">
        <span>gate ≥ {data.dispatchGate}</span>
        <span>{data.rubricCount} rubrics</span>
        <span>S{data.scoring.strong}/M{data.scoring.medium}/W{data.scoring.weak}</span>
        <span>TP ≥ {data.scoring.confirmedTp}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

- [ ] **Step 2: Write `brain/components/nodes/RubricNode.tsx`**

```tsx
import { Handle, Position } from "@xyflow/react";

export function RubricNode({ data }: { data: any }) {
  const specOnly = data.provenance === "spec_only";
  return (
    <div className={`w-[240px] rounded-xl border p-3 shadow ${specOnly ? "border-dashed border-zinc-500/60 bg-bg-elevated/50 opacity-80" : "border-accent-violet/60 bg-bg-elevated/90"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-accent-violet">rubric</span>
        <span className={`rounded px-1.5 py-0.5 text-[9px] ${specOnly ? "bg-zinc-600/30 text-zinc-300" : "bg-accent-violet/20 text-accent-violet"}`}>
          {specOnly ? "spec only" : "gem"}
        </span>
      </div>
      <div className="text-sm font-semibold">{data.name}</div>
      <div className="font-mono text-[10px] text-zinc-500">{data.rubricId}</div>
      <div className="mt-2 flex flex-wrap gap-1 font-mono text-[10px] text-zinc-300">
        <span className="rounded bg-zinc-700/40 px-1.5">{data.severity}</span>
        <span className="rounded bg-zinc-700/40 px-1.5">{data.signalCount} signals</span>
        {data.requiredBoundaries.length > 0 && (
          <span className="rounded bg-zinc-700/40 px-1.5">{data.requiredBoundaries.length} boundaries</span>
        )}
        {data.hasTraced && <span className="rounded bg-emerald-600/30 px-1.5 text-emerald-300">⬡ traced</span>}
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

- [ ] **Step 3: Write `brain/components/nodes/SignalNode.tsx`**

```tsx
import { Handle, Position } from "@xyflow/react";
import { STRENGTH_CHIP } from "@/brain/palette";

export function SignalNode({ data }: { data: any }) {
  const mock = data.graphSource === "mock";
  return (
    <div className="w-[240px] cursor-pointer rounded-lg border border-zinc-600/60 bg-bg-elevated/80 p-2.5 shadow transition hover:border-accent-cyan/70">
      <div className="flex items-center justify-between">
        <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${STRENGTH_CHIP[data.strength as keyof typeof STRENGTH_CHIP]}`}>
          {data.strength} · {data.points}
        </span>
        <span className={`text-[9px] ${mock ? "text-amber-400" : "text-emerald-400"}`}>{mock ? "mock" : "traced"}</span>
      </div>
      <div className="mt-1 text-[12px] leading-tight">{data.name}</div>
      <Handle type="target" position={Position.Left} />
    </div>
  );
}
```

- [ ] **Step 4: Write `brain/components/ClusterCanvas.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import { ReactFlow, Background, Controls, MiniMap, BackgroundVariant } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { BrainModel } from "@/brain/types";
import { toClusterGraph } from "@/brain/transform/toClusterGraph";
import { CategoryNode } from "@/brain/components/nodes/CategoryNode";
import { RubricNode } from "@/brain/components/nodes/RubricNode";
import { SignalNode } from "@/brain/components/nodes/SignalNode";

const nodeTypes = { category: CategoryNode, rubric: RubricNode, signal: SignalNode };

export function ClusterCanvas({ model, onOpenSignal }: { model: BrainModel; onOpenSignal: (signalId: string) => void }) {
  const { nodes, edges } = useMemo(() => toClusterGraph(model), [model]);
  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.15}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          if (node.type === "signal") onOpenSignal((node.data as any).signalId);
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 5: Verify in browser (temporary mount)**

Temporarily render `ClusterCanvas` from `BrainBoard` to view it (Task 16 finalizes wiring). Edit `brain/components/BrainBoard.tsx` body to:
```tsx
"use client";
import { ClusterCanvas } from "@/brain/components/ClusterCanvas";
import type { BrainModel } from "@/brain/types";
export function BrainBoard({ model }: { model: BrainModel }) {
  return (
    <div className="h-screen w-screen">
      <ClusterCanvas model={model} onOpenSignal={(id) => console.log("open", id)} />
    </div>
  );
}
```
Open `http://localhost:3000/brain`.
Expected: a left→right map — 1 category node, 10 rubric nodes (5 solid `gem`, 5 dashed `spec only`), 44 signal nodes with strength chips and traced/mock tags. Pan/zoom/minimap work. Clicking a signal logs `open <signalId>` in the console.

- [ ] **Step 6: Commit**

```bash
git add brain/components/ClusterCanvas.tsx brain/components/nodes/CategoryNode.tsx brain/components/nodes/RubricNode.tsx brain/components/nodes/SignalNode.tsx brain/components/BrainBoard.tsx
git commit -m "feat(brain): Layer-1 cluster canvas + custom nodes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Attack canvas + rich attack node (Layer 2 UI)

The drill-in execution graph. Rich, expandable nodes (kind/phase/boundary/role/static/frida/signature); dashed treatment + banner for mocks.

**Files:**
- Create: `brain/components/nodes/AttackNode.tsx`
- Create: `brain/components/AttackCanvas.tsx`

- [ ] **Step 1: Write `brain/components/nodes/AttackNode.tsx`**

```tsx
import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { KIND_STYLE } from "@/brain/palette";

export function AttackNode({ data }: { data: any }) {
  const [open, setOpen] = useState(false);
  const ring = data.isRequired ? "ring-2 ring-accent-cyan/70" : "";
  const dashed = data.mock ? "border-dashed" : "";
  return (
    <div
      className={`w-[260px] rounded-lg border bg-bg-elevated/90 p-2.5 shadow ${KIND_STYLE[data.kind as keyof typeof KIND_STYLE]} ${ring} ${dashed}`}
      onClick={() => setOpen((o) => !o)}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
        <span>{data.kind}</span>
        {data.isEntry && <span className="text-accent-green">entry</span>}
        {data.isRequired && <span className="text-accent-cyan">required</span>}
      </div>
      <div className="mt-0.5 text-[12px] font-medium leading-tight text-zinc-100">{data.label}</div>
      <div className="font-mono text-[10px] text-zinc-500">{data.phase}{data.boundary ? ` · ${data.boundary}` : ""}</div>
      {open && (
        <div className="mt-2 space-y-1 border-t border-zinc-700/50 pt-2 font-mono text-[10px] text-zinc-300">
          {data.behavioralRole && <div>role: {data.behavioralRole}</div>}
          <div>static_confirmed: {String(data.staticConfirmed ?? "—")}</div>
          {data.fridaHook && <div className="break-all">hook: {data.fridaHook}</div>}
          {data.signature ? (
            <div className="break-all">
              <div>{data.signature.className}.{data.signature.method}</div>
              <div className="text-zinc-500">{data.signature.filePath}:{data.signature.line}</div>
              <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-1 text-[9px] text-zinc-300">{data.signature.snippet}</pre>
            </div>
          ) : (
            <div className="text-amber-400">no signature (mock)</div>
          )}
        </div>
      )}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

- [ ] **Step 2: Write `brain/components/AttackCanvas.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import { ReactFlow, Background, Controls, MiniMap, BackgroundVariant, Panel } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SignalView, RubricView } from "@/brain/types";
import { toAttackGraph } from "@/brain/transform/toAttackGraph";
import { AttackNode } from "@/brain/components/nodes/AttackNode";

const nodeTypes = { attack: AttackNode };

export function AttackCanvas({ rubric, signal, onBack }: { rubric: RubricView; signal: SignalView; onBack: () => void }) {
  const { nodes, edges } = useMemo(() => toAttackGraph(signal.attackGraph), [signal]);
  const mock = signal.attackGraph.source === "mock";
  const confirmedReq = signal.attackGraph.nodes.filter((n) => n.isRequired).length;

  return (
    <div className="h-full w-full">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.2} proOptions={{ hideAttribution: true }}>
        <Background variant={BackgroundVariant.Dots} gap={24} />
        <MiniMap pannable zoomable />
        <Controls />
        <Panel position="top-left" className="rounded-lg border border-zinc-700/60 bg-bg-elevated/95 p-3 text-xs">
          <button onClick={onBack} className="mb-2 rounded bg-zinc-700/50 px-2 py-1 text-[11px] hover:bg-zinc-600/50">← back to clusters</button>
          <div className="font-semibold text-zinc-100">{rubric.name}</div>
          <div className="text-zinc-400">{signal.name}</div>
          <div className="mt-1 font-mono text-[10px] text-zinc-300">
            strength {signal.strength} · {signal.points} pts · required {confirmedReq}/{signal.attackGraph.requiredNodes.length}
          </div>
          {mock && (
            <div className="mt-2 rounded bg-amber-500/15 px-2 py-1 text-[10px] text-amber-300">
              MOCK — placeholder graph, to be replaced
            </div>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 3: Commit (UI verified in Task 16)**

```bash
git add brain/components/AttackCanvas.tsx brain/components/nodes/AttackNode.tsx
git commit -m "feat(brain): Layer-2 attack canvas + rich attack node

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: BrainBoard drill state + Legend + FilterBar

Final wiring: cluster ↔ attack drill navigation, a legend, and a strength/provenance filter.

**Files:**
- Create: `brain/components/Legend.tsx`
- Create: `brain/components/FilterBar.tsx`
- Modify: `brain/components/BrainBoard.tsx`

- [ ] **Step 1: Write `brain/components/Legend.tsx`**

```tsx
import { STRENGTH_CHIP } from "@/brain/palette";

export function Legend() {
  const strengths = ["strong", "medium", "weak", "non_signal"] as const;
  return (
    <div className="rounded-lg border border-zinc-700/60 bg-bg-elevated/95 p-3 text-[10px]">
      <div className="mb-1 uppercase tracking-wider text-zinc-400">legend</div>
      <div className="flex flex-wrap gap-1">
        {strengths.map((s) => (
          <span key={s} className={`rounded border px-1.5 py-0.5 ${STRENGTH_CHIP[s]}`}>{s}</span>
        ))}
      </div>
      <div className="mt-2 flex gap-2 text-zinc-300">
        <span className="text-emerald-400">⬡ traced</span>
        <span className="text-amber-400">mock</span>
        <span className="text-zinc-400">dashed = spec only</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `brain/components/FilterBar.tsx`**

```tsx
"use client";

import type { Strength } from "@/brain/types";

export interface Filters { strengths: Set<Strength>; gemOnly: boolean }

export function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const all: Strength[] = ["strong", "medium", "weak", "non_signal"];
  const toggle = (s: Strength) => {
    const next = new Set(filters.strengths);
    next.has(s) ? next.delete(s) : next.add(s);
    onChange({ ...filters, strengths: next });
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-bg-elevated/95 p-2 text-[11px]">
      <span className="text-zinc-400">filter:</span>
      {all.map((s) => (
        <button
          key={s}
          onClick={() => toggle(s)}
          className={`rounded px-2 py-0.5 ${filters.strengths.has(s) ? "bg-accent-cyan/30 text-accent-cyan" : "bg-zinc-700/40 text-zinc-400"}`}
        >
          {s}
        </button>
      ))}
      <button
        onClick={() => onChange({ ...filters, gemOnly: !filters.gemOnly })}
        className={`rounded px-2 py-0.5 ${filters.gemOnly ? "bg-accent-violet/30 text-accent-violet" : "bg-zinc-700/40 text-zinc-400"}`}
      >
        gem only
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `brain/components/BrainBoard.tsx`** with drill state + filtering

```tsx
"use client";

import { useMemo, useState } from "react";
import type { BrainModel, Strength } from "@/brain/types";
import { ClusterCanvas } from "@/brain/components/ClusterCanvas";
import { AttackCanvas } from "@/brain/components/AttackCanvas";
import { Legend } from "@/brain/components/Legend";
import { FilterBar, type Filters } from "@/brain/components/FilterBar";

export function BrainBoard({ model }: { model: BrainModel }) {
  const [openSignalId, setOpenSignalId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    strengths: new Set<Strength>(["strong", "medium", "weak", "non_signal"]),
    gemOnly: false,
  });

  // Apply filters to a shallow-cloned model (drops signals/rubrics that don't match).
  const filtered = useMemo<BrainModel>(() => {
    const categories = model.categories.map((cat) => ({
      ...cat,
      rubrics: cat.rubrics
        .filter((r) => (filters.gemOnly ? r.provenance === "gem" : true))
        .map((r) => ({ ...r, signals: r.signals.filter((s) => filters.strengths.has(s.strength)) }))
        .filter((r) => r.signals.length > 0),
    }));
    return { categories };
  }, [model, filters]);

  // Find the open signal + its rubric across the (unfiltered) model.
  const open = useMemo(() => {
    if (!openSignalId) return null;
    for (const cat of model.categories)
      for (const rub of cat.rubrics) {
        const sig = rub.signals.find((s) => s.id === openSignalId);
        if (sig) return { rubric: rub, signal: sig };
      }
    return null;
  }, [model, openSignalId]);

  return (
    <div className="flex h-screen w-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="font-mono text-sm text-accent-cyan">
          brain · family clustering
          <span className="ml-2 text-zinc-500">
            {open ? "› attack graph" : "› riskware clusters"}
          </span>
        </div>
        {!open && <FilterBar filters={filters} onChange={setFilters} />}
      </header>

      <div className="relative flex-1">
        {open ? (
          <AttackCanvas rubric={open.rubric} signal={open.signal} onBack={() => setOpenSignalId(null)} />
        ) : (
          <ClusterCanvas model={filtered} onOpenSignal={setOpenSignalId} />
        )}
        {!open && (
          <div className="absolute bottom-4 right-4">
            <Legend />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Full browser verification**

Ensure dev server is running (`npm run dev`); open `http://localhost:3000/brain`.
Verify:
1. Cluster map shows 1 category / 10 rubrics / 44 signals; `spec_only` rubrics dashed, `gem` solid.
2. FilterBar: toggling `weak` off hides weak signals; "gem only" hides the 5 spec_only rubrics.
3. Click the signal **"App loads affiliate link into a Webview w/ conversion data"** (under MMP) → Layer 2 shows the **traced** 10-node graph; clicking a node expands its real `signature` snippet; required nodes are ringed; no MOCK banner.
4. Click any other signal → a **mock** graph with dashed nodes + the amber "MOCK — placeholder" banner; expanding a node shows "no signature (mock)".
5. "← back to clusters" returns to Layer 1. No console errors.

- [ ] **Step 5: Commit**

```bash
git add brain/components/BrainBoard.tsx brain/components/Legend.tsx brain/components/FilterBar.tsx
git commit -m "feat(brain): drill navigation + legend + filter bar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: README, final verification, and full suite

**Files:**
- Create: `brain/README.md`

- [ ] **Step 1: Write `brain/README.md`**

```markdown
# brain/ — Family-Clustering Visualization Board

Standalone research board (NOT part of the product). Visualizes the full
`riskware` family-clustering graph: Category → Rubric → Signal taxonomy
(10 rubrics / 44 signals, from `docs/riskware_rubrics_processed.xlsx`) drilling
into per-signal attack execution graphs (1 real traced graph + 43 generated mocks).

## Open it
- `npm run dev`, then visit **http://localhost:3000/brain** (unlinked from the
  product nav — reachable only by URL).

## Data
- `data/riskwareTaxonomy.ts` — GENERATED from the xlsx by
  `scripts/brain-gen-taxonomy.mjs`. Regenerate after the spreadsheet changes:
  `node scripts/brain-gen-taxonomy.mjs`.
- `adapter/loadModel.ts` — server-only: taxonomy + the real gem traced graph
  (`attribution_gated_webview_uncloaking`) + generated mocks → one `BrainModel`.
- Mock graphs are flagged `source: "mock"` and rendered dashed with a banner;
  they are placeholders to be replaced as real `graph.yaml` traces are authored.

## Guarantees (tests)
- `__tests__/taxonomy.test.ts` — 10 rubrics / 44 signals / S-M-W-NS = 13/11/19/1.
- `__tests__/gemConsistency.test.ts` — the 5 gem-backed rubrics' `chains.yaml`
  match the taxonomy (drift guard).

## Adding categories later
`BrainModel.categories` is an array and the cluster transform is
category-agnostic — adding a category is a data addition (+ a switcher in the UI).
```

- [ ] **Step 2: Full suite + typecheck + build**

Run: `npm run test`
Expected: all `brain/__tests__/*` pass + all pre-existing tests pass.

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: Next build succeeds; `/brain` appears in the route list.

- [ ] **Step 3: Confirm product isolation**

Run: `grep -rn "brain" components/TopNav.tsx app/page.tsx`
Expected: no matches (the board is not linked anywhere in the product UI).

Run: `git diff --name-only main...HEAD -- ':!brain' ':!app/brain' ':!docs' ':!scripts/brain-gen-taxonomy.mjs'`
Expected: only `package.json` and `package-lock.json` (deps) — confirming no product files were modified.

- [ ] **Step 4: Commit**

```bash
git add brain/README.md
git commit -m "docs(brain): README + final verification

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Summary to user**

Report: cluster map renders all 10 rubrics / 44 signals; the MMP strong-8 signal drills into its real traced graph (signatures visible), every other signal into a flagged mock; taxonomy + gem-consistency tests green; no product files touched beyond dependencies. Branch `brain-family-clustering` ready for review.

---

## Notes for the implementer

- **React Flow v12 import is `@xyflow/react`** (not the old `reactflow`). CSS import `@xyflow/react/dist/style.css` is required once per canvas component (already included).
- **Custom nodes need `Handle`s** (source/target) or edges won't attach — every custom node above includes them.
- **`"use client"`** is required on every component that imports `@xyflow/react` or uses hooks/state (`ClusterCanvas`, `AttackCanvas`, `BrainBoard`, `FilterBar`). Pure node components (`CategoryNode` etc.) are imported only by client components, so they don't each need the directive, but adding it is harmless.
- **Tailwind tokens** (`bg-bg-base`, `bg-bg-elevated`, `accent-cyan`, `accent-violet`, `accent-amber`, `accent-green`) come from `app/globals.css` / `tailwind.config.ts`. If a token is missing, substitute the nearest existing one rather than inventing new config.
- **Do not edit gems to make `gemConsistency.test.ts` pass** — gems are product source of truth; a failure is a real finding to report.
- If `npm run build` complains about `force-dynamic` + server-only fs, confirm `app/brain/page.tsx` is a server component (no `"use client"`).
```
