#!/usr/bin/env node
// =====================================================================
// darkside dynamic-research preflight CLI.
//
//   npm run preflight           # against http://localhost:3000
//   DARKSIDE_URL=... npm run preflight
//
// Verifies the dynamic environment is alive (mandatory: HTTP Toolkit, NordVPN,
// connected device + network; optional: Frida) BEFORE a run, by calling the
// in-app /api/preflight (same core as Diagnostics → Dynamic preflight).
// Exit: 0 = all mandatory alive · 1 = a mandatory tool down/unconfirmed ·
// 2 = could not reach the app. See docs/DYNAMIC-SETUP.md.
// =====================================================================

const PORT = process.env.PORT || "3000";
const BASE = (process.env.DARKSIDE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const URL = `${BASE}/api/preflight`;

const C = { reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m", green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m" };
const MARK = { alive: `${C.green}✓ alive${C.reset}`, dead: `${C.red}✗ down${C.reset}`, unknown: `${C.yellow}? confirm${C.reset}` };

async function main() {
  console.log(`${C.bold}dynamic preflight${C.reset} ${C.dim}→ ${URL}${C.reset}\n`);

  let report;
  try {
    const res = await fetch(URL, { headers: { accept: "application/json" } });
    report = await res.json();
  } catch (err) {
    console.error(`${C.red}Could not reach the app at ${BASE}.${C.reset}`);
    console.error(`${C.dim}Start it (npm run dev / npm start), then re-run. ${err?.message ?? err}${C.reset}`);
    process.exit(2);
  }

  if (!report.checks) {
    console.error(`${C.red}Preflight error:${C.reset} ${report.message ?? "no checks returned"}`);
    process.exit(1);
  }

  for (const c of report.checks) {
    const req = c.mandatory ? `${C.dim}[mandatory]${C.reset}` : `${C.dim}[optional]${C.reset}`;
    console.log(`  ${MARK[c.status] ?? "?"} ${c.label} ${req}`);
    if (c.detail) console.log(`      ${C.dim}${c.detail}${C.reset}`);
    if (c.status !== "alive" && c.remediation) console.log(`      ${C.yellow}↳ ${c.remediation}${C.reset}`);
  }

  const { mandatoryAlive, mandatoryTotal, optionalAlive } = report.summary;
  console.log(
    `\n${report.ok ? C.green + "READY" : C.red + "NOT READY"}${C.reset} ` +
      `${C.dim}· mandatory ${mandatoryAlive}/${mandatoryTotal} alive · optional ${optionalAlive} alive · ${report.env.platform}${C.reset}`,
  );
  if (!report.ok) console.log(`${C.yellow}Do not start a dynamic run until all mandatory tools are alive.${C.reset}`);

  process.exit(report.ok ? 0 : 1);
}

main();
