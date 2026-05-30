# darkside — Week-to-Deploy Roadmap (LOCKED 2026-05-30)

**North star:** the **first real two-machine e2e** — a batch of locked apps flows through a **case queue**, Sky Walker analyzes decompiled code on the Yoda machine, missions are carried on the device to the Darth Vader machine, and Vader runs the **real rig** (Frida server, rooted device, NordVPN, HTTPToolkit, logcat — all already installed there) through a **pluggable tool layer**, returning verified evidence that reconciles to a score.

**Status:** gem-driven Rubric/Gem layer + real filesystem PixelBridge + responsive full-width UI on `main`. Single golden case, single 8-pt chain, dynamic side simulated.

## Locked decisions (2026-05-30)
1. **Deploy:** local **role-gated zips only** this week — no hosted demo.
2. **Role-gating:** **hard-lock per `ROLE`** (`yoda` | `vader`) — each zip shows only its machine.
3. **Dynamic:** do **not** build the device rig (it exists on the Vader machine). Build a **pluggable tool layer**: typed adapters (mock locally / real on the machine) + **one global tool catalog** the Vader agent is instructed from. Adding a capability = one catalog entry.
4. **Multi-chain:** add a **4-pt chain alongside the 8-pt in the attribution rubric**; show the investigation total summing confirmed chains (8 → 8+4).
5. **Intake:** a batch = a **list of `{packageName, category, metadata_score}`** + per-case **decompiled-code folder** (Sky Walker static) + **APK** (Vader install). `metadata_score >= 8` qualifies for dispatch. The Yoda machine's existing locked-apps list + manual decompile/install pages get **harmonized into one queue view** (later).

---

## Workstreams

### A. Pluggable tool layer + global catalog  *(unblocks the real Vader rig)*
- `gems/tools/catalog.yaml` — one declarative catalog. Each tool: `id`, `capability` (`instrument` | `http_capture` | `log_capture` | `geo_control` | `device_fs` | `payload_pull` | `screenshot` | `decompile` | `apk_download` | `install`), `owner_machine` (`yoda`|`vader`), description, agent-invocation note, `status`.
  - Seed it with the rig you have: Frida→`instrument`, HTTPToolkit→`http_capture`, logcat→`log_capture`, NordVPN→`geo_control`, rooted device→`device_fs`/`payload_pull`, screenshot; plus Yoda-side `decompile`/`apk_download`/`install`.
- `lib/tools/types.ts` + `lib/tools/registry.ts` — typed `ToolAdapter { id, capability, run(args) }`; a registry that loads the catalog. **Mock adapters** in-repo; the Vader machine swaps **real adapters** (no setup here — just the plug points).
- Rubric `evidence_contract` references **capabilities**, not specific tools; `buildVaderExperiments` maps required boundaries → capabilities → catalog tools.
- The **Vader gem** is generated/instructed from the catalog ("you have these tools…").
- **Acceptance:** adding a tool to `catalog.yaml` makes it available to the experiment plan + shows in the UI; mock run produces the golden evidence; real adapters drop in on the machine.

### B. Case queue + batch intake  *(the multi-package backbone)*
- Data model: `Case { package_name, category, metadata_score, identity, decompiled_path?, apk_path?, status }`; a `Batch` = `Case[]`.
- Intake adapters (via the catalog): accept a `{packageName, category, metadata_score}` JSON list; `apk_download` + `install` (Vader); produce/point to a `decompiled_path` (Yoda) for Sky Walker.
- **Queue view both sides** (hard-locked by role): Yoda = review/dispatch queue (sorted by metadata_score, gate at ≥8); Vader = run queue. Per-case status through the pipeline (`queued → static → qualified → carried → running → evidence → reconciled`).
- Bridge already keys by `mission_id` → supports N concurrent cases; add a **batch bundle** (carry many missions/evidence in one device file) + per-case progress.
- **Acceptance:** drop a batch list → queue populates → process several cases → per-case scores aggregate; one device bundle carries the batch.

### C. Multi-chain scoring (8 + 4)
- Author the **4-pt chain** in `attribution_gated_webview_uncloaking` (remote-config/Firebase URL→WebView, **no** cloaking gate = a complete lower-severity behavior) + the `cloaking_gate` node for the 8-pt path.
- **Wire `aggregateScore` into the live reconcile path** (retire the duplicate vs `score.ts`); footer shows `8` or `8+4=12 / max`.
- **Acceptance:** UI shows the investigation total summing only confirmed chains; partial (one chain confirmed) reads correctly.

### D. Screenshot evidence component
- `ScreenshotEvidence`: full-res lightbox, multiple shots/node, caption + timestamp + sha256 + node link; gallery on the reconciled card. Verify large-image bundles import with integrity.
- **Acceptance:** a node carries N screenshots, openable full-res, sha256-verified on import.

### E. Testing
- Unit: tool registry/adapters (mock), `scoreStaticPotential` thresholds, multi-chain `aggregateScore`, malformed-YAML rejection.
- Contract: `produce → pack → import` preserves checksums + every artifact sha256 (incl. batch bundles).
- **Playwright e2e:** full UI airgap loop (stage → export → import → run(mock) → export → import → reconcile → Strong 8), CI-runnable.
- **Acceptance:** `npm test` + `npm run e2e` green in CI.

### F. Prompt evals (gems)
- Eval harness: gem + decompiled-sources fixture → score `static_potential_report` vs golden (boundaries, qualifies_for_vader, dynamic aids). Negative fixtures (SDK-only, WebView-only) must reject.
- Vader gem now reads the **tool catalog** — eval that it picks correct capabilities per boundary.
- **Acceptance:** gems pass golden + reject FPs on the target model.

### G. Two-machine zips  *(the deliverable)*
- `ROLE` env (`yoda`|`vader`): route guard + nav hides the other machine; per-machine `bridge/` dir.
- `scripts/package.mjs` → **`darkside-yoda.zip`** + **`darkside-vader.zip`**, each self-contained (`npm ci && build && start`) pinned to its role, with an **operator README** (intake a batch, stage, export, carry the device bundle, import, run via the rig, carry back, reconcile) and a **tool-catalog stub** for the Vader machine to fill with real adapters.
- **Acceptance:** unzip on the two machines, run a batch end-to-end with real Vader tooling, reconcile to scores.

---

## Suggested sequence
- **Day 1:** C (4-pt chain + wire aggregateScore) + start E (contract round-trip) — locks scoring before scale.
- **Day 1–2:** B (Case/Batch model + queue views, role-aware) — the backbone everything else hangs on.
- **Day 2–3:** A (tool catalog + typed adapters + experiment-plan mapping + Vader gem from catalog).
- **Day 3–4:** G (ROLE lock + packaging zips + operator README) → dry-run the two-machine loop locally (mock tools).
- **Day 4:** D (screenshot evidence) + E (Playwright e2e in CI).
- **Day 5:** F (gem evals, first real LLM on static) → hand the zips to the real machines for the **first real two-machine e2e** (real Vader rig via the adapters).

## Deferred TODOs (later, not this build)
- **Rubric Library tab** — browse Category → Rubric → Chain → graph blueprint from the gems (no live case), reusing CallGraph in a no-evidence "blueprint" mode. This is where chains/graphs get viewed standalone. (Confirmed: build later.)
- **Wire rubric.yaml scoring into the loader** — `rubric.yaml` now carries `points_if_strong` + `scoring{strong/medium/weak}` as the rubric-level source of truth; runtime still reads `chains.yaml`. When the Library/multi-rubric work lands, add a `RubricSchema` + load it and keep the two consistent.

### Terminology (locked)
- **score** = chain `strength`→`points` (weak=2/medium=4/strong=8), binary per chain, summed at the investigation level. Lives on the rubric (`points_if_strong`+`scoring`) AND on each chain.
- **severity** = threat-priority for triage (high/medium/low) — how dangerous if confirmed; NOT the score. Distinct vocabulary on purpose.

## Carry-over (from the merged PR review)
- Wire `aggregateScore` into the live path (folds into C).
- Demo route: derive evidence node-ids from the compiled mission to prevent desync (folds into E).
