# darkside — Week-to-Deploy Roadmap

**Date:** 2026-05-30
**North star:** the **first real two-machine end-to-end test** (Yoda machine ↔ device-carried bundle ↔ Darth Vader machine), and a clear path to a **full deploy**.
**Status now:** single Next.js app, gem-driven Rubric/Gem layer on `main`, real filesystem PixelBridge with airgapped export/import bundles, premium responsive UI (full-width desktop, no overflow). Dynamic side is still simulated (no real Frida/device yet).

---

## The 6 workstreams (from the brief)

### 1. Screenshot evidence component
**Goal:** screenshots are first-class evidence attached per node, not just a thumbnail.
- A dedicated `ScreenshotEvidence` component: full-size view, zoom/lightbox, caption, timestamp, sha256, and the node it proves.
- Vader attaches real captured PNGs (already modeled as `Artifact{kind:"screenshot"}`); make the viewer support multiple screenshots/node and a gallery.
- Wire into the bundle: screenshots already travel as base64 artifacts in `EvidenceBundle`; verify large-image bundles import cleanly (size budget + integrity).
- **Acceptance:** a node can carry N screenshots; reviewer can open full-res; sha256 verified on import.

### 2. Add rubrics / chains / graphs (the knowledge library)
**Goal:** prove the gem layer scales by adding the real chains you'll append.
- Author the **4-pt and 2-pt chains** for `attribution_gated_webview_uncloaking` (e.g. remote-config/Firebase URL→WebView *without* a cloaking gate = a distinct complete 4-pt behavior) — exercises cross-chain partial scoring (8 / 8+4 / …).
- Add the **`cloaking_gate` boundary node** + the 13-node behavioral graph variant (the spec's richer graph) so the gate is explicit.
- Add a **second rubric** under riskware to validate Yoda's multi-rubric dispatch + `aggregateScore` (wire `aggregateScore` into the live reconcile path — currently forward scaffolding).
- **Acceptance:** dropping a new `rubrics/<id>/*.yaml` + registering it in `category.yaml` makes it appear and score with zero code changes.

### 3. Testing
**Goal:** lock the invariants before two machines depend on them.
- Unit: extend `lib/gems` tests (scoreStaticPotential thresholds, aggregateScore multi-chain, loader rejects malformed YAML).
- Contract round-trip: a test that `produce → pack → import` preserves checksums + every artifact sha256 (assert against `bridge-fs`).
- **E2E (Playwright):** script the full UI airgap — Yoda stage→export, Vader import→run→export, Yoda import→reconcile→Strong 8 — as a CI-runnable spec. Add `data-testid`s where selectors are fragile.
- **Acceptance:** `npm test` + an `npm run e2e` both green in CI.

### 4. Prompt optimization (the gems)
**Goal:** make the Sky Walker / Yoda / reconciliation gems reliable when a real LLM runs them.
- Build a tiny **eval harness**: feed the gem + a decompiled-sources fixture to a model, score the `static_potential_report` against a golden expectation (boundaries found, qualifies_for_vader, dynamic aids emitted).
- Iterate gem wording for: behavior-over-names matching, honest boundary status, never inventing partial credit. Use the `prompt-optimizer` skill.
- Add 2–3 negative fixtures (benign SDK-only, WebView-only) to confirm the gems reject false positives.
- **Acceptance:** gems pass the eval on the golden case + reject the FP fixtures, on the target model.

### 5. Two-machine-ready zipped projects
**Goal:** one runnable bundle per machine for the first real e2e.
- Introduce a **`ROLE` env** (`yoda` | `vader`): the app boots locked to one side (route guard + nav hides the other machine), with its own `bridge/` dir on that machine's disk.
- A `scripts/package.mjs` that emits **`darkside-yoda.zip`** and **`darkside-vader.zip`** — each a self-contained app (`npm ci && npm run build && npm start`) pinned to its role, plus an **operator README** (how to stage/export, carry the bundle on the device, import, run, carry back).
- The airgap transport is already real (export downloads a bundle file; import uploads it + verifies sha256) — this is the seam the two machines use.
- **Acceptance:** unzip on two laptops, run the full mission→evidence→reconcile loop by hand-carrying two `.json` bundles; Yoda lands on Strong 8.

### 6. Full deploy
**Goal:** a hosted demo + the real-machine path.
- **Deploy gotcha (decide):** the real fs bridge writes to `./bridge` — Vercel serverless fs is ephemeral/read-only except `/tmp`. Options: (a) hosted **demo mode** that uses the in-process/`/tmp` bridge for a single-session showcase; (b) back the bridge with Vercel Blob/KV; (c) keep the airgap (real machines) off-Vercel and deploy only a **read-only demo** of the UI. Recommend (a) for the hosted demo + (c)'s zips for the real test.
- Add `vercel.ts` config, env wiring, and a `DEMO=1` mode that auto-seeds a populated case.
- **Acceptance:** a public URL shows the full reconciled proof; the zips run the real two-machine loop locally.

---

## Suggested week sequence

- **Day 1–2:** #2 chains/graphs (4-pt + 2-pt + 2nd rubric, wire `aggregateScore`) + #3 contract round-trip test. Highest leverage: proves the scaling thesis and locks scoring.
- **Day 2–3:** #1 screenshot evidence component + bundle size/integrity check.
- **Day 3–4:** #5 ROLE env + packaging zips + operator README → **dry-run the two-machine loop** on two local checkouts.
- **Day 4–5:** #4 prompt eval harness + gem iteration (first real LLM in the loop on the static side).
- **Day 5:** #3 Playwright e2e in CI + #6 hosted demo mode.
- **End of week:** first real two-machine e2e (real bundle carry; dynamic still mock-or-first-Frida) + a public demo URL.

---

## Key decisions to confirm (for the morning)
1. **Deploy target:** hosted demo (Vercel `/tmp` demo mode) vs. only the local two-machine zips vs. both? (Recommend both.)
2. **Real Frida scope for the first e2e:** keep Vader simulated (real *transport*, mock *dynamic*) for the first two-machine run, then add real Frida next iteration? (Recommend yes — de-risks by testing the airgap first.)
3. **4-pt chain identity:** confirm the Firebase/remote-config-without-gate behavior as the canonical 4-pt chain (you said you'd append real chains — drop them in `gems/riskware/rubrics/` and we wire them).
4. **Role-gating:** hard lock per `ROLE` (recommended for the real test) vs. keep both routes visible.

## Carry-over follow-ups (small, from the merged PR's review)
- Wire `aggregateScore` into the live reconcile/Yoda path (retire the duplicate vs `score.ts`) — folds into #2.
- Demo route currently pairs the gem mission with hand-authored evidence; derive evidence node-ids from the compiled mission to prevent silent desync — folds into #3.
