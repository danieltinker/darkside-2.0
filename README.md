# darkside — MMP uncloaking, end-to-end across two machines

darkside proves one riskware technique (attribution-gated WebView "cloaking")
all the way through, across an airgap:

- **Yoda** (static analysis machine) locates the call chain, scores it, and ships a
  **MissionContext** over PixelBridge.
- **Darth Vader** (dynamic analysis machine) runs the app, attaches per-node Frida/HTTP/
  screenshot evidence, and ships an **EvidenceReturn** back.
- The two sides never talk directly — a single self-contained **bundle** is carried on a
  device between them. Each machine renders only what's been materialized into its own
  `bridge/` mailboxes.

Scoring is **binary per chain**: a fully-confirmed chain is worth its strength
(strong 8 / medium 4 / weak 2), anything missing is 0; the investigation total sums
confirmed chains. Rubrics + chains are processed from a private source-of-truth and live
under `gems/riskware/`.

---

## Requirements

- **Node.js ≥ 20.11** (LTS 20 or 22 recommended) and **npm**. That's it — this is a
  Next.js/TypeScript app; there is **no Python, no venv, and no `requirements.txt`**.
- No database or external services. The PixelBridge transport is real files on local
  disk under `bridge/` (git-ignored).

Check your Node version:

```bash
node -v   # should print v20.11+ or v22+
```

## Install

```bash
npm ci          # reproducible install from package-lock.json (preferred)
# or: npm install
```

## Run (development)

```bash
npm run dev     # http://localhost:3000
```

## Run (production)

```bash
npm run build
npm start       # serves the optimized build on http://localhost:3000 (PORT=… to change)
```

## Pages

| Route          | What it is |
|----------------|------------|
| `/`            | Overview — the two-machine narrative |
| `/queue`       | Case queue — all packages across rubrics, per-case chain breakdown + score |
| `/yoda`        | Static side — the confirmed call graph Yoda ships |
| `/vader`       | Dynamic side — run experiments, attach evidence, export the bundle |
| `/bridge`      | PixelBridge — the real on-disk mailboxes + bundle import/export |
| `/diagnostics` | End-to-end self-check (see below) |

---

## Diagnostics — "what's running, and where did it break?"

When something breaks in the field (after a zip transfer), run the diagnostics and send
the report back. It exercises the **entire flow** step by step — load + validate every
gem, compile the golden mission, reset the bridge, produce/pack/import the mission and
evidence bundles (both directions, with checksum + artifact verification), read state,
reconcile, and assert the golden score is strong 8. Every step is timed and any failure
is captured (the run never aborts), so the report pinpoints the broken stage.

**In the app:** open `/diagnostics`, click **Run diagnostics**, then **copy report JSON**.

**From the terminal** (the app must be running):

```bash
npm run diagnose
# → prints a step-by-step log and writes darkside-diagnostics-<timestamp>.json
# Override the target with: DARKSIDE_URL=http://host:port npm run diagnose
```

Exit codes: `0` all pass · `1` a step failed · `2` could not reach the app.

**Send back** the `darkside-diagnostics-*.json` (or the copied JSON). It contains the
Node/platform/app version and the per-step status, timing, detail, and error — enough to
diagnose the runtime break and ship a patched build.

Both paths call the same core (`lib/diagnostics.ts` via `GET /api/diagnostics`), so the
CLI and the UI report identically.

---

## Checks (for development / CI)

```bash
npm test         # vitest — unit + full-flow round-trip
npm run typecheck   # tsc --noEmit
npm run build       # production build (also type-checks routes)
```

---

## The airgap / zip-transfer model

In production the two machines each run their own copy of this app with their own
`bridge/` directory:

```
Yoda machine                         Darth Vader machine
  bridge/yoda_outbox/  ──(carry the bundle on a device)──▶  bridge/vader_inbox/
  bridge/yoda_inbox/   ◀──(carry the evidence bundle back)── bridge/vader_outbox/
```

- Yoda exports a **mission bundle** (`/bridge` → Export) → carried → imported on Vader.
- Vader runs, exports an **evidence bundle** → carried back → imported on Yoda.
- Every contract message carries a checksum verified on read; every bundle artifact
  carries a real sha256 verified on import.

> The `/bridge` page also has a **demo round-trip** that performs the full
> produce→pack→import→produce→pack→import in-process (same verified path, no physical
> carry) so you can see the end state on one machine.

Role-pinned two-machine zips (`darkside-yoda.zip` / `darkside-vader.zip`) are on the
roadmap; today both roles run from this one app.
