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
