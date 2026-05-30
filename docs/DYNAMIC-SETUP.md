# Dynamic analysis machine — setup & preflight (Darth Vader)

The dynamic side runs the target app on a **real rooted Android device** wired to the
analysis host, with traffic interception and geo control in place. darkside does **not**
ship or manage these tools — this manual is how an operator stands the environment up,
and `npm run preflight` (and the **Diagnostics → Dynamic preflight** panel) verify it's
alive before any run.

> **Mandatory:** HTTP Toolkit · NordVPN · a connected rooted device with network access.
> **Optional (recommended):** Frida.
> If a mandatory tool can't be auto-detected, preflight reports it and asks you to
> confirm it's on — **do not start a dynamic run until preflight is green.**

---

## 1. Rooted Android device + adb (mandatory)

- A **rooted** Android device (or rooted emulator image), connected by **USB cable**.
- Install Android platform-tools (`adb`).
  - macOS: `brew install android-platform-tools`
- Enable USB debugging on the device, then authorize the host:
  ```bash
  adb devices          # device must list as "device" (not "unauthorized"/"offline")
  adb shell id         # should show uid=0 (root) after `adb root` if supported
  ```
- **Network access** from the device is required (the app must reach its trackers/C2):
  ```bash
  adb shell ping -c1 8.8.8.8     # must succeed
  ```

## 2. HTTP Toolkit — traffic interception (MANDATORY)

Intercepts the device's HTTPS so the tracker response (the cloaked `dl` field) is visible.

- Install: https://httptoolkit.com  (`brew install --cask http-toolkit` on macOS)
- Start an **Android device via ADB** interception from HTTP Toolkit (installs its CA and
  sets the proxy automatically), **or** set the device proxy to the host + install the
  HTTP Toolkit CA cert into the system trust store (root required for system-level trust).
- Note the proxy port HTTP Toolkit shows (commonly **8000**). Export it so preflight can
  probe it if it isn't the default:
  ```bash
  export HTTPTOOLKIT_PROXY_PORT=8000
  ```
- Verify: traffic from the device appears in HTTP Toolkit's view.

## 3. NordVPN — geo control (MANDATORY)

Drives the geo-targeting experiments (e.g. organic vs non-organic, country sweeps).

- Install NordVPN and **connect** to the country under test before the run.
- Linux exposes a CLI preflight can read (`nordvpn status`). On macOS/Windows there is no
  official CLI — preflight will mark it **unknown** and ask you to **confirm in the app
  that it shows "Connected"**.

## 4. Frida — instrumentation (optional, recommended)

Confirms each node at runtime via hooks (the `⌗ view hook` scripts in the UI).

- Host: `pipx install frida-tools` (or `pip install frida-tools`).
- Device: push and run a matching **frida-server** (root), e.g.:
  ```bash
  adb push frida-server /data/local/tmp/ && adb shell "chmod 755 /data/local/tmp/frida-server"
  adb shell "/data/local/tmp/frida-server &"
  ```
- Verify: `frida-ps -U` lists device processes.

## 5. MCP servers (if driving via the agent harness)

If the analysis is driven through the agent harness, the relevant MCP servers (e.g. the
Playwright/browser MCP, and any HTTP Toolkit MCP integration) must be connected in the
harness. These are host-side and not probed by preflight.

---

## Preflight — verify before every run

```bash
npm run preflight        # against http://localhost:3000 (app must be running)
# or open the app → Diagnostics → "Run dynamic preflight"
```

It checks, per tool: **alive / dead / unknown**, marks mandatory failures, and prints
remediation. Exit code: `0` all mandatory alive · `1` a mandatory tool is down/unconfirmed
· `2` could not reach the app. The same report is downloadable to send back when a run
behaves unexpectedly.

| Check | Mandatory | How it's probed |
|-------|-----------|-----------------|
| Device connected (adb) | ✔ | `adb devices` shows a `device` |
| Device network access | ✔ | `adb shell ping -c1 8.8.8.8` |
| HTTP Toolkit proxy | ✔ | TCP connect to `127.0.0.1:$HTTPTOOLKIT_PROXY_PORT` (default 8000) |
| NordVPN connected | ✔ | `nordvpn status` (Linux) — else **confirm manually** |
| Frida server | ✗ (recommended) | `frida-ps -U` lists device processes |
