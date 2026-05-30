#!/usr/bin/env node
// =====================================================================
// darkside field diagnostics CLI.
//
//   npm run diagnose            # against http://localhost:3000
//   DARKSIDE_URL=... npm run diagnose
//
// Calls the in-app /api/diagnostics endpoint (the SAME diagnostic core the
// UI button uses), prints a step-by-step log, and writes the full JSON report
// to darkside-diagnostics-<timestamp>.json. Send that file back to debug a
// runtime break in the field. Exit code: 0 = all pass, 1 = something failed,
// 2 = could not reach the app.
// =====================================================================

import { writeFileSync } from "node:fs";

const PORT = process.env.PORT || "3000";
const BASE = (process.env.DARKSIDE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const URL = `${BASE}/api/diagnostics`;

const C = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m",
};
const mark = { pass: `${C.green}✓${C.reset}`, fail: `${C.red}✗${C.reset}`, skip: `${C.yellow}∅${C.reset}` };

async function main() {
  console.log(`${C.bold}darkside diagnostics${C.reset} ${C.dim}→ ${URL}${C.reset}\n`);

  let report;
  try {
    const res = await fetch(URL, { headers: { accept: "application/json" } });
    report = await res.json();
  } catch (err) {
    console.error(`${C.red}Could not reach the app at ${BASE}.${C.reset}`);
    console.error(`${C.dim}Start it first (npm run dev, or npm run build && npm start), then re-run.${C.reset}`);
    console.error(`${C.dim}${err?.message ?? err}${C.reset}`);
    process.exit(2);
  }

  if (report.error && !report.steps) {
    console.error(`${C.red}Harness crash:${C.reset} ${report.message}`);
    process.exit(1);
  }

  for (const s of report.steps) {
    const detail = s.detail ? ` ${C.dim}${JSON.stringify(s.detail)}${C.reset}` : "";
    console.log(`  ${mark[s.status] ?? "?"} ${s.label} ${C.dim}(${s.ms}ms)${C.reset}${detail}`);
    if (s.error) console.log(`      ${C.red}↳ ${s.error}${C.reset}`);
  }

  const { passed, failed, skipped, total } = report.summary;
  console.log(
    `\n${report.ok ? C.green + "ALL PASS" : C.red + "FAILED"}${C.reset} ` +
      `${C.dim}· ${passed}/${total} passed, ${failed} failed, ${skipped} skipped · ${report.durationMs}ms · ` +
      `node ${report.env.node} ${report.env.platform} · app v${report.env.appVersion}${C.reset}`,
  );

  // Write a timestamped JSON report to send back. (No Date in the report body
  // itself beyond startedAt; the filename stamp is local to the operator.)
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = `darkside-diagnostics-${stamp}.json`;
  writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`${C.cyan}report written → ${file}${C.reset}  ${C.dim}(send this file back)${C.reset}`);

  process.exit(report.ok ? 0 : 1);
}

main();
