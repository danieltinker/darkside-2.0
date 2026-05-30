# Riskware gems — processing notes

The riskware rubric/chain knowledge is **processed from a private source-of-truth
spreadsheet + a private chains zip** that are **gitignored and never committed**
(`riskware_rubrics_processed.xlsx`, `riskware_chains.zip`, any unzipped lib). Only
the **processed gem artifacts** (the `*.yaml` in this tree) are public.

## Source → schema mapping
- **Category** = the spreadsheet (`riskware`).
- **Rubric** = a row group (col A name + col B description).
- **Chain** = a signal (col C) with a **strength** (col D) → points:
  `strong=8 · medium=4 · weak=2 · non_signal=0`. Scored **binary per chain**
  (confirmed → its points, else 0); the investigation total sums confirmed chains.
- A **flow graph is optional** on a chain — most chains are signal-level
  (`{name, strength, points}`); only fully-traced chains carry a graph.

## Processed so far (verifiable subset — the source has more)
- `attribution_gated_webview_uncloaking` — the one **detailed 11-node traced graph**
  (= the source's "MMP cloaking" rubric). Now carries **all 5 source signals**:
  2 strong (loads affiliate link in WebView; changes behavior on Organic/NonOrganic),
  1 medium (stores conversion data), 1 weak (sends to remote endpoint), 1 non_signal
  (conversion flow empty). `chains[0]` is the traced strong chain (goldenMission
  depends on it being first). The demo hero.
- `arbitrary_obfuscated_url_loading` — 10 signal-level chains (incl. the Firebase
  loadUrl strong signal, HTTP-response→WebView, external-config URL, etc.).
- `command_and_control` — the known-riskware-URL strong signal (ties to
  `lib/known-urls.ts`).
- `runtime_loading_of_code` — 5 signal chains (homes the `dynamicDexDecryption`
  blueprint).
- `device_info_cloaking` — 9 anti-analysis signal chains (4 medium: battery, motion,
  required-packages, hardware-info · 5 weak: root, emulator, touch-count,
  development_settings, adb_enabled). **No strong chain in source** — scores by
  accumulating confirmed chains, demonstrating cross-chain gradation.

Every chain's `strength→points` is asserted in `lib/gems/__tests__/loadGem.test.ts`.

## Case queue (multi-package)
`lib/cases.ts` holds the roster (one TRACED golden case + signal-level cases spanning
rubrics, with varied verdicts: scored / partial / fp / running / locked). `lib/caseRows.ts`
(server-only) joins it with each rubric's `chains.yaml` and computes the binary-per-chain
score. Surfaced on the `/queue` tab (`components/CaseQueue.tsx`). No-drift + scoring
asserted in `lib/__tests__/caseRows.test.ts`.

## Architecture adjustments
- **Done — chain = weighted signal:** `strength` adds `non_signal`, `points` adds
  `0`, `required_boundaries`/`required_nodes` optional. See `lib/gems/types.ts`.
- **Done — behavioral blueprints:** the private chains zip's **5 `.dot` graphs** are
  processed into public `gems/riskware/blueprints/*.graph.yaml`
  (`onConversionDataSucces`, `httpResponseWebView`, `conditionalStaticSignals`,
  `dynamicDexDecryption`, `privacyPolicyRedirection`). A blueprint is **role-level,
  signature-free** (`BlueprintGraphSchema` in `lib/gems/types.ts`): node kinds add
  `condition` / `benign_branch` / `assessment` / `verdict`; edges carry branch
  conditions (e.g. `af_status == Non-organic`); each blueprint declares its owning
  `rubric_id`/`chain_id`. Loaded via `loadBlueprint(id)`; faithfulness +
  blueprint→chain relations asserted in `lib/gems/__tests__/loadGem.test.ts`.
  `dynamicDexDecryption` awaits its `runtime_loading_of_code` rubric (chain_id null).
- **Reconcile (TODO):** the MMP blueprint (`onConversionDataSucces`) is the canonical
  **14-node** graph (N1..N13 with N7 split into benign 7a / evasion 7b; explicit
  cloak-gate N6, AST/dynamic assessment, verdict). Our live demo still uses the
  leaner **9-node traced** graph (`rubrics/attribution_gated_webview_uncloaking/
  graph.yaml`, with per-app signatures). Converge the traced graph onto the 14-node
  blueprint, then re-attach signatures. The blueprint is the rubric-level truth; the
  traced graph is one per-case instantiation.
- **Render (later):** blueprints have no UI surface yet — the deferred Rubric Library
  tab will render them (reuse the graph view; show role/phase/branch, no code).

Regenerate processed rubrics from the (private) source with the processor; never
commit the source.
