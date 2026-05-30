# Two-machine deploy — role zips & first e2e

darkside runs as two role-pinned copies that never talk directly; a single
**bundle file** is carried on a device between them (the airgap). This guide
builds the zips and runs the first real end-to-end.

## 1. Build the zips (on the dev machine)

```bash
npm run package
# → dist/darkside-yoda-v<version>.zip   (Yoda = static / mission control)
# → dist/darkside-vader-v<version>.zip  (Vader = dynamic lab)
```

The version comes from `package.json` and is stamped into the zip name, each
zip's `.env` (`DARKSIDE_VERSION`), and the header chip in the UI. **Both
machines must run the same version** — the header shows it.

Each zip is built from `git archive HEAD` — **only committed, tracked files**
ship, so the private source-of-truth (xlsx / chains zip / unzipped lib) can
never be inside one. The script also greps each finished zip and **aborts** if
any private pattern slips through. Each zip carries a role `.env`
(`NEXT_PUBLIC_DARKSIDE_ROLE` pins the UI) and an `OPERATOR-README.md`.

> Zips are built from committed HEAD — commit your work first (the script warns
> about uncommitted changes).

## 2. Install on each machine (localhost)

Copy `darkside-yoda.zip` to the Yoda machine and `darkside-vader.zip` to the
Vader machine. On each:

```bash
unzip darkside-<role>.zip && cd darkside-<role>
npm ci
npm run build
npm start            # http://localhost:3000
```

Node ≥ 20.11, no Python/venv. The nav is **role-locked**: Yoda shows
Queue/Agent/Yoda; Vader shows only Vader + Bridge + Diagnostics. A role chip in
the header confirms which machine you're on.

**Vader machine — before running:** open **Diagnostics → Run dynamic preflight**
and confirm the mandatory tools are alive (HTTP Toolkit, NordVPN, a connected
rooted device with network). See `docs/DYNAMIC-SETUP.md`.

## 3. The end-to-end run

```
YODA machine                                   VADER machine
─────────────                                  ─────────────
Queue → Install & Decompile (arm static agent)
Agent → dispatch → done static
Bridge → Export mission bundle  ──────┐
   darkbridge-mission-<id>.json       │  (carry on device: USB / AirDrop)
                                      └──▶ Bridge → Import mission bundle
                                           (preflight green) Vader → run dynamic
                                           Bridge → Export evidence bundle
        Bridge → Import evidence  ◀──────  darkbridge-evidence-<id>.json
   reconcile → score (strong 8)            (carry back on device)
```

1. **Yoda:** Queue → pick the MMP case → **Install & Decompile** → **Agent** →
   dispatch + mark done static → **Bridge → Export mission bundle**.
2. Carry `darkbridge-mission-*.json` to the **Vader** machine.
3. **Vader:** **Bridge → Import** it (checksum verified) → **Vader → run dynamic
   experiments** → **Bridge → Export evidence bundle**.
4. Carry `darkbridge-evidence-*.json` back to the **Yoda** machine.
5. **Yoda:** **Bridge → Import** it (artifact sha256s verified) → reconcile →
   **score strong 8**.

Every contract message carries a checksum verified on read; every bundle
artifact carries a real sha256 verified on import — so a corrupted or tampered
carry is caught.

## 4. If something breaks

- **`npm run diagnose`** (either machine) → step-by-step report; send back the
  `darkside-diagnostics-*.json`.
- **`npm run preflight`** (Vader) → which tool/device is down + how to fix.
- Reset a machine's transport state: delete its `bridge/` directory (it's
  re-created on next run).

> Each machine keeps its own `bridge/` on local disk; nothing crosses the airgap
> except the bundle file you carry. The `/bridge` page's **demo round-trip**
> performs the whole flow in-process on one machine if you want to rehearse first.
