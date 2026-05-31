# Vader machine — production setup prompt

> Give this file to an engineer or a coding agent on the **Vader** machine. It maps
> the mocked dynamic side to the real on-device tooling. **The contract is law:** the
> `EvidenceReturn` shape in `lib/contract.ts` and the bundle format in `lib/bridge-fs.ts`
> must not change — Yoda reconciles whatever you return through them. Keep `npm test` green.

## Role
Vader is the **dynamic lab**: import a **MissionContext** carried from Yoda → run the app on a
**real rooted device** with traffic interception + geo control → confirm each node of the flow at
runtime → emit an **EvidenceReturn** (per-node evidence + artifacts + extracted payloads + observed
URLs) → ship it back over PixelBridge.

Run pinned to this role: `.env` has `DARKSIDE_ROLE=vader` (nav locked to Vader/Bridge/Diagnostics).
Localhost: `npm ci && npm run build && npm start`.

## Before any run — system health is the gate
`/diagnostics` → **Device system health** computes two gates (`lib/preflight.ts`, already real — it
spawns the host tools):
- **Install gate** (adb push): needs the device connected.
- **Dynamic dispatch gate**: needs **Frida + device network + HTTP Toolkit + NordVPN** all alive.

Set the environment up per **`docs/DYNAMIC-SETUP.md`** (rooted device + adb, HTTP Toolkit interception,
NordVPN connected, frida-server). `npm run preflight` must report **READY** / both gates GO before you
dispatch. NordVPN country is parsed and shown — confirm the target geo.

## What is mocked today → what to plug in

1. **Dynamic evidence production** — *mock:* `lib/mock.ts` ships a canned `EvidenceReturn` +
   `nodeEvidence` + artifacts; `POST /api/bridge/evidence` calls `produceEvidence(mock…)`. *Real:* build
   a **Frida-driven runner** that takes the **imported** MissionContext (`bridge/vader_inbox/<id>.MissionContext.json`)
   and, for each node, sets the hook in `node.frida_hook` (the exact targets are in the mission's
   `flow.nodes[].frida_hook`; the UI's **⌗ view hook** shows the generated script). It must:
   - run the **two experiments** the cloak gate needs — **Organic** (NordVPN→benign control) and
     **Non-organic** (→ uncloak) — using the mission's `dynamic_aids.mock_responses`/`decryptors` as the
     known tracker payload/keys.
   - capture **real artifacts**: Frida logs, **HTTP Toolkit** HARs (the tracker response carrying the
     wrapped URL), screenshots of the rendered WebView.
   - pull any **dropper/packer** off the device into storage → `ExtractedPayload`.
   - emit an `EvidenceReturn` with `node_evidence[]` (each `reconfirmed_static` + `dynamic_status` +
     `artifacts` + `observation`), `found_urls`, `dynamic_confirmed`, `dynamic_score`, `verdict`.

2. **Tool adapters (the pluggable seam)** — keep one place that the runner calls:
   - **Frida** — `frida-ps -U` / attach + the hook scripts per node.
   - **HTTP Toolkit** — the intercepting proxy (port from `HTTPTOOLKIT_PROXY_PORT`); export the HAR per request.
   - **NordVPN** — geo-control for the organic/non-organic + country-sweep experiments.
   - **adb** — install/uninstall, file pull, `/proc` + device fs.
   These are exactly the tools `lib/preflight.ts` already probes; the runner consumes them.

3. **Artifacts on disk** — `produceEvidence` writes real files under `bridge/artifacts/<id>/`
   (frida/http/screenshots/payloads) + `_content.json`. Keep that layout — the bundle packer reads it and
   the artifact sha256s are verified on Yoda's import.

## Round-trip
`/bridge` → **Import** the carried mission bundle (checksum verified) → run → **Export evidence bundle**
(`darkbridge-evidence-<id>-<short>.json`, artifacts embedded + hashed) → carry back to Yoda.

## Keep intact (don't refactor)
- `EvidenceReturn` shape (`lib/contract.ts`) + the bundle format/verification (`lib/bridge-fs.ts`).
- The mission's `required_nodes` are the boundaries that must be confirmed for the strong score — confirm
  all of them (each satisfiable by any technique variant via `flexible_match`).

## Verify
`npm run preflight` (READY) before a run; `npm run diagnose` + `npm test` stay green.
