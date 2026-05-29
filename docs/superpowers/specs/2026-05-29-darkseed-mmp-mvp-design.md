# darkside — MMP Uncloaking MVP — Design

**Date:** 2026-05-29
**Source spec:** `darkseed_mmp_MVP.md` (in the reference `darkclaude` repo)
**Repo:** `github.com/danieltinker/darkside-2.0`

---

## 1. Mission

Prove one riskware technique — **MMP cloaking** — end-to-end across two machines.
**Yoda** (static / mission control) statically confirms a 3-stage attack chain and
ships a mission to **Darth Vader** (dynamic lab) over **PixelBridge**. Vader
re-confirms statically, runs the app, attaches Frida/HTTP/screenshot evidence per
node, and ships the evidence back. The UI renders **one confirmed call graph** where
every node carries a **static signature + dynamic evidence + status**. A fully
confirmed chain scores **strong = 8 points**.

The deliverable is the **seamless transfer contract** between the two systems and the
**premium per-node proof GUI**.

## 2. Scope

**In:** one IOC (`mmp_cloaking`, 8 pts); one flow (`onConversionDataSuccess` → parse
URL from a web request → load in a WebView); two machine views (`/yoda`, `/vader`); a
simulated append-only PixelBridge; one custom mission card; one fully-authored golden
case; premium cyber-research aesthetic.

**Out:** other rubrics, multi-rubric, gate-policy engine, worker-adapter abstraction,
queue management, agents/prompt pages, analytics, auth, real Frida/devices/ADB, any
database.

## 3. Locked decisions (from brainstorm, 2026-05-29)

1. **Repo / placement.** Fresh Next.js app in a new directory `darkside-2.0`, new git
   repo, remote → `danieltinker/darkside-2.0`, **commit + push after each phase**. The
   existing `darkclaude` checkout is left untouched as reference. No code ported from
   darkclaude (different schema, different scoring model).

2. **Persistence: pre-baked + client state.** The golden case is fully authored in
   `lib/mock.ts`. The bridge and the "Send mission" / "Send evidence" actions are
   **guided visual transitions over known data**; human confirm/reject/flip and the
   score recompute live in **client React state** (reset on reload). `bridge.ts` still
   exposes the real `MissionContext` / `EvidenceReturn` *shapes* — the contract is real
   even though the transport is mocked. The known-URL DB is a real in-process O(1)
   `Map`; the TP write-back runs and surfaces a "DB updated · +N URLs" note (durable
   within the running session only — honest about the no-DB constraint).

3. **Scoring is binary per IOC chain.** For `mmp_cloaking`: **8 if the whole
   static+dynamic chain is confirmed, 0 if anything is missing.** No fractional score
   within a chain — half a chain proves nothing. "Partial" emerges only at the
   *investigation* level once other IOC chains (worth **4** and **2** points) are added
   and summed. Therefore `score.ts` is a **sum-of-confirmed-chains** model
   (`investigationScore = Σ confirmed_chain.points`, `max = Σ all_chain.points`); the
   MVP supplies exactly one 8-point chain (total 8 or 0), and 4/2-point chains slot in
   later with no refactor.

4. **Native path is ACTIVE in the golden case.** Vader proves the `libcloak.so` JNI
   path executed: `native_file.confirmed_active = true`, NATIVE ACTIVE chip, and the
   live route is `n3_coro → n3_native → n3_load`.

**Defaults adopted (correctable):**
- `produces_url` is set on **`n2_deobf`** (the recovered cleartext). Known-URL match is
  by normalized URL with a domain fallback. The decryptor's `decrypted_strings` shows
  the same cleartext statically; the `KNOWN RISKWARE URL` badge fires when a runtime
  `found_urls` entry matches the DB.
- Fresh premium dark design language (not ported). Yoda = green/static, Vader =
  red/dynamic colour coding on the two halves of each node card.
- Per-phase verification = `tsc --noEmit` / `next build` + a Playwright screenshot of
  the rendered card. No unit-test suite for a mock UI.
- Payload download = a static file under `public/payloads/`; the authenticated
  `/api/payloads/:id` production path is noted in a comment only.

## 4. The one IOC: `mmp_cloaking` (strong = 8)

The true affiliate URL never appears in static strings. It is built at runtime from a
tracker response and loaded into a WebView through obfuscated indirection.

| Stage | Node | kind | what it does |
|---|---|---|---|
| **1 · Trigger** | `n1_callback` | trigger | `AttribListener.onConversionDataSuccess(Map)` fires; reads attribution token |
| **2 · URL build** | `n2_invoke` | dispatch | `a.invoke(data)` orchestrates the build |
| | `n2_http` | http | `a.g(token)` GET to tracker endpoint |
| | `n2_parse` | parse | `JSONObject(resp).optString("dl")` pulls the URL field |
| | `n2_deobf` | deobf | `B64.dec(...)` / XOR unwrap → cleartext affiliate URL (`produces_url`) |
| **3 · Sink** | `n3_o` | dispatch | `MainActivity.o(url)` hands URL into a cloak object |
| | `n3_coro` | dispatch | `Cloak$block$1.invokeSuspend` coroutine indirection |
| | `n3_native` | dispatch | `libcloak.so` JNI dispatch (native obfuscation, **active**) |
| | `n3_load` | sink | `WebView.loadUrl(url)` — the real sink |

**Edges (one graph):** `n1→n2_invoke (calls)`, `n2_invoke→n2_http (calls)`,
`n2_http→n2_parse (returns)`, `n2_parse→n2_deobf (data_to)`,
`n2_deobf→n2_invoke (returns)`, `n2_invoke→n3_o (data_to)`, `n3_o→n3_coro (calls)`,
`n3_coro→n3_native (calls)`, `n3_native→n3_load (triggers)`.

**`required_nodes` (gate the 8):** `n1_callback`, `n2_parse`, `n3_load`. Sub-steps
enrich the proof; the boundaries gate the score.

## 5. Cross-machine contract (`lib/contract.ts`)

§4 of the source spec, verbatim, is law. Types: `CaseIdentity`, `QueueLock`,
`NodeSignature`, `Decryptor`, `NativeFile`, `FlowNode`, `FlowEdge`, `FlowGraph`,
`MissionContext`, `Artifact`, `NodeEvidence`, `ExtractedPayload`, `EvidenceReturn`,
`HumanReview`, `KnownRiskwareUrl`, `MissionStatus`. No fields added that both machines
don't need.

**Statuses:** `LOCKED → STATIC_CONFIRMED → MISSION_SENT → RECEIVED → DYNAMIC_RUNNING →
EVIDENCE_SENT → SCORED`. Per-node state is two fields: `static_confirmed` (Yoda) and
`dynamic_status` (Vader).

**PixelBridge (simulated):** `bridge/yoda_outbox`, `vader_inbox`, `vader_outbox`,
`yoda_inbox`, `artifacts/<mission_id>/...`. Append-only, write-`.tmp`-then-rename,
`checksum` per message, idempotent by `mission_id`. MVP simulates the shapes; transport
is mocked.

## 6. Known-riskware-URL DB (`lib/known-urls.ts`)

In-process `Map` keyed by normalized URL **and** domain → O(1) lookup.
`lookupUrl(url)`, `lookupDomain(domain)`, `recordTp(url, domain, mission_id,
package_name)`. On evidence return, each `found_urls` entry runs `lookupUrl`; a hit is
prior corroboration → `KNOWN RISKWARE URL` badge + bump `hits`. On `confirmed_tp`
(agent score or human flip), `recordTp` writes every found URL back so the corpus
grows. A hit never awards points by itself; dynamic confirmation still gates the 8.

## 7. Scoring (`lib/score.ts`)

```
chainConfirmed(chain) = every required_node has dynamic_status === 'confirmed'
                        AND static_confirmed
chainScore(chain)     = chainConfirmed ? chain.points_if_strong : 0
investigationScore    = { total: Σ chainScore, max: Σ points_if_strong, perChain }
```

Human override recompute: `confirmed_tp` → chain confirmed (8); `failed_fp` → 0;
rejecting any required node breaks the chain → 0. Both agent and human verdicts are
retained (audit trail). MVP = one 8-chain ⇒ effective score is 8 or 0.

## 8. UI

Routes: `/` (landing — the one case, open in Yoda/Vader), `/yoda` (static LEFT column +
Send mission), `/vader` (receive + dynamic RIGHT column + Send evidence), `/yoda`
post-return (reconciled read view + human controls + O(1) badge + score footer).

Components:
- `MissionCard` — header (package · version · developer · countries · QueueLockID ·
  status · IOC chip) + footer/scoring + human-review chrome.
- `CallGraph` — **the hero**: 3 stage bands, sub-steps nested in order, edges with
  relation labels.
- `NodeCard` — two columns: LEFT static signature (`class.method`, `file:line`,
  snippet, STATIC CONFIRMED chip; decryptor table on deobf; NativeFile + NATIVE
  ACTIVE/INERT chip on native; KNOWN RISKWARE URL badge on `produces_url`); RIGHT
  dynamic evidence (`frida_hook`, artifacts, CONFIRMED/FAILED/PENDING chip,
  observation).
- `EvidenceViewer` — Frida log / HTTP request-response / screenshot renderers.
- `PayloadCard` — extracted dropper/packer + Download affordance.
- `HumanReview` — per-node confirm/reject + flip-verdict (auto-updates score).
- `StatusChip`.

Aesthetic: premium dark cyber-research — restrained, high-contrast, legible, monospace
for code/signatures, the graph as the hero, not busy.

## 9. Build phases (commit + push after each)

0. **Scaffold** — Next 15 app, configs, layout, globals, this design doc, git init +
   remote + push.
1. **Contract + flow + score + known-urls** — `lib/contract.ts`, `lib/flow.ts`,
   `lib/score.ts`, `lib/known-urls.ts`. `tsc` passes, no UI.
2. **Mock golden case + artifacts** — `lib/mock.ts` (full case, all required nodes
   confirmed → strong 8, native active, found URLs, one dropper). Placeholder Frida
   `.log` / HTTP `.har` / screenshots / dropper in `public/`. Seed the URL DB.
3. **Mission card hero** — `CallGraph` + `NodeCard` + `EvidenceViewer` + scoring
   footer. The premium centerpiece.
4. **Yoda view** — static confirm + Send mission (writes MissionContext).
5. **Vader view** — receive + attach evidence (native confirm, payload, found URLs) +
   Send evidence (writes EvidenceReturn).
6. **Human-in-the-loop + DB write-back** — confirm/flip with score auto-update;
   `recordTp` on confirmed_tp; "DB updated" note + `PayloadCard`.
7. **Reconcile + polish** — Yoda renders returned evidence → strong 8; premium pass;
   Playwright golden-path screenshot.

## 10. Definition of done

One MMP case flows Yoda → PixelBridge → Vader → PixelBridge → Yoda. The call graph
shows all 3 stages + sub-steps as one connected graph; every node has a static
signature and dynamic evidence and a confirmed/failed status. The URL-build chain
(HTTP → parse → deobfuscate) and the cloaked-load chain (coroutine → native → loadUrl)
are both shown connected. All required boundary nodes confirmed → strong 8,
`confirmed_tp`. The contract messages + statuses are the only things crossing the
boundary. Decryptor + recovered strings show inline on the deobf node; the native file
shows with a NATIVE ACTIVE chip. The known-URL DB does an O(1) lookup (badge on hit)
and writes back on `confirmed_tp`. Human-in-the-loop per-node confirm/reject + verdict
flip auto-updates the score, retaining both verdicts. The dropper shows an
extracted-payload card with a download. Renders in a premium, legible cyber-research
GUI.
