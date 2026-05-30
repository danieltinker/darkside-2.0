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
- `attribution_gated_webview_uncloaking` — the one **detailed 9-node traced graph**
  (= the source's "MMP cloaking" strong "loads affiliate link in WebView w/
  conversion data" chain). Hand-built earlier; the demo hero.
- `arbitrary_obfuscated_url_loading` — 10 signal-level chains (incl. the Firebase
  loadUrl strong signal, HTTP-response→WebView, external-config URL, etc.).
- `command_and_control` — the known-riskware-URL strong signal (ties to
  `lib/known-urls.ts`).

Every chain's `strength→points` is asserted in `lib/gems/__tests__/loadGem.test.ts`.

## Architecture adjustments
- **Done:** `Chain` is a weighted signal — `strength` adds `non_signal`, `points`
  adds `0`, and `required_boundaries`/`required_nodes` are optional (signal-level
  chains have no graph). See `lib/gems/types.ts`.
- **Next (TODO):** the private chains zip contains **5 real behavioral blueprints**
  (`onConversionDataSucces`, `httpResponseWebView`, `conditionalStaticSignals`,
  `dynamicDexDecryption`, `privacyPolicyRedirection`) as `.md` + `.dot` + `.png`.
  These are **role-level blueprints with NO per-app code signatures**, so to import
  them we need a **blueprint-graph** notion: make `GemNode.signature` optional
  (blueprint nodes carry `behavioral_role`/`phase`/`boundary`/`flexible_match`; a
  per-case *traced* graph fills the concrete signatures at analysis time).
- **Reconcile (TODO):** our 9-node `attribution_gated_webview_uncloaking` graph vs
  the source's **13-node** MMP blueprint (which has an explicit cloaking-gate node,
  benign/evasion branches, and AST/dynamic assessment nodes). Converge on the 13-node
  blueprint, then attach per-case signatures.

Regenerate processed rubrics from the (private) source with the processor; never
commit the source.
