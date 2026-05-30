import "server-only";
import { execFile } from "node:child_process";
import net from "node:net";

// =====================================================================
// Dynamic-research preflight — verify the on-host tools + device are alive
// before a run. Runs on the Vader machine (the Next server IS the host), so
// it can probe local processes via child_process. Mandatory: HTTP Toolkit,
// NordVPN, a connected device with network. Optional: Frida. Probes are
// best-effort and never throw; a tool we can't auto-detect is "unknown" and
// the operator is asked to confirm it manually. See docs/DYNAMIC-SETUP.md.
// =====================================================================

export type ToolStatus = "alive" | "dead" | "unknown";

export type ToolCheck = {
  id: string;
  label: string;
  mandatory: boolean;
  status: ToolStatus;
  detail?: string;
  remediation?: string;
};

export type PreflightReport = {
  ok: boolean; // every MANDATORY check is alive
  ranAt: string;
  env: { platform: string; proxyPort: number };
  summary: { mandatoryAlive: number; mandatoryTotal: number; optionalAlive: number };
  checks: ToolCheck[];
};

type Run = { code: number | string; stdout: string; stderr: string; notFound: boolean };

function run(cmd: string, args: string[], timeoutMs = 4000): Promise<Run> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout, stderr) => {
      const e = err as (NodeJS.ErrnoException & { code?: number | string }) | null;
      resolve({
        code: e?.code ?? 0,
        stdout: stdout?.toString() ?? "",
        stderr: stderr?.toString() ?? "",
        notFound: e?.code === "ENOENT",
      });
    });
  });
}

function tcpProbe(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    const done = (v: boolean) => {
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
  });
}

async function checkAdbDevice(): Promise<ToolCheck> {
  const base = { id: "device.adb", label: "Rooted device connected (adb)", mandatory: true };
  const r = await run("adb", ["devices"]);
  if (r.notFound) {
    return { ...base, status: "dead", detail: "adb not found on PATH", remediation: "Install android-platform-tools and connect the device by USB." };
  }
  const devices = r.stdout
    .split("\n")
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => /\tdevice$/.test(l));
  if (devices.length > 0) return { ...base, status: "alive", detail: `${devices.length} device(s) attached` };
  return { ...base, status: "dead", detail: "no authorized device", remediation: "Connect the device, accept the USB-debugging prompt (`adb devices` should show 'device')." };
}

async function checkDeviceNetwork(): Promise<ToolCheck> {
  const base = { id: "device.network", label: "Device has network access", mandatory: true };
  const r = await run("adb", ["shell", "ping", "-c1", "-W2", "8.8.8.8"]);
  if (r.notFound) return { ...base, status: "unknown", detail: "adb not found", remediation: "Install adb + connect the device first." };
  if (typeof r.code === "number" && r.code === 0 && /1 (packets )?received|, 0% packet loss/.test(r.stdout)) {
    return { ...base, status: "alive", detail: "ping 8.8.8.8 ok" };
  }
  return { ...base, status: "dead", detail: "device could not reach the internet", remediation: "Check the device's Wi-Fi/data and that the VPN/proxy isn't blocking egress." };
}

async function checkHttpToolkit(proxyPort: number): Promise<ToolCheck> {
  const base = { id: "proxy.httptoolkit", label: "HTTP Toolkit proxy", mandatory: true };
  const up = await tcpProbe("127.0.0.1", proxyPort);
  if (up) return { ...base, status: "alive", detail: `proxy reachable on 127.0.0.1:${proxyPort}` };
  return { ...base, status: "dead", detail: `nothing listening on 127.0.0.1:${proxyPort}`, remediation: "Start HTTP Toolkit and intercept the device; set HTTPTOOLKIT_PROXY_PORT if not 8000." };
}

async function checkNordVpn(): Promise<ToolCheck> {
  const base = { id: "vpn.nordvpn", label: "NordVPN connected", mandatory: true };
  const r = await run("nordvpn", ["status"]);
  if (r.notFound) {
    return { ...base, status: "unknown", detail: "no nordvpn CLI on this platform", remediation: "Open NordVPN and confirm it shows 'Connected' to the target country (no CLI on macOS/Windows to auto-verify)." };
  }
  if (/Status:\s*Connected/i.test(r.stdout)) return { ...base, status: "alive", detail: r.stdout.split("\n").find((l) => /Country|Server/i.test(l))?.trim() ?? "connected" };
  return { ...base, status: "dead", detail: "not connected", remediation: "Connect NordVPN to the target country before the run." };
}

async function checkFrida(): Promise<ToolCheck> {
  const base = { id: "frida", label: "Frida server (optional)", mandatory: false };
  const r = await run("frida-ps", ["-U"]);
  if (r.notFound) return { ...base, status: "unknown", detail: "frida-tools not installed", remediation: "Optional: `pipx install frida-tools` + run frida-server on the device." };
  if (typeof r.code === "number" && r.code === 0) return { ...base, status: "alive", detail: "frida-ps -U responded" };
  return { ...base, status: "dead", detail: "frida-server not reachable on the device", remediation: "Optional: start frida-server (root) on the device." };
}

export async function runPreflight(): Promise<PreflightReport> {
  const proxyPort = Number(process.env.HTTPTOOLKIT_PROXY_PORT) || 8000;
  const checks = await Promise.all([
    checkAdbDevice(),
    checkDeviceNetwork(),
    checkHttpToolkit(proxyPort),
    checkNordVpn(),
    checkFrida(),
  ]);

  const mandatory = checks.filter((c) => c.mandatory);
  const mandatoryAlive = mandatory.filter((c) => c.status === "alive").length;
  const optionalAlive = checks.filter((c) => !c.mandatory && c.status === "alive").length;

  return {
    ok: mandatory.every((c) => c.status === "alive"),
    ranAt: new Date().toISOString(),
    env: { platform: process.platform, proxyPort },
    summary: { mandatoryAlive, mandatoryTotal: mandatory.length, optionalAlive },
    checks,
  };
}
