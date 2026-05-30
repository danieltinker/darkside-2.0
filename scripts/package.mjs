#!/usr/bin/env node
// =====================================================================
// Build the two role-pinned distribution zips for the two-machine e2e:
//   dist/darkside-yoda.zip   · dist/darkside-vader.zip
//
//   npm run package
//
// SAFETY: each zip is built from `git archive HEAD` — ONLY committed, tracked
// files ship. The private source (xlsx / chains zip / unzipped lib) is
// gitignored and therefore can never be in a zip. The script also greps the
// finished zip for private patterns and ABORTS if any slip through.
//
// Each zip gets a role .env (NEXT_PUBLIC_DARKSIDE_ROLE pins the UI) + a
// per-role OPERATOR-README.md. Operators run: npm ci && npm run build && npm start.
// =====================================================================

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const STAGE = path.join(DIST, "stage");
const ROLES = ["yoda", "vader"];

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"], ...opts }).toString();
}

// Warn (don't block) on uncommitted changes — zips are built from HEAD.
const dirty = sh("git", ["status", "--porcelain"]).trim();
if (dirty) {
  console.warn("⚠ Uncommitted changes are NOT included (zips are built from committed HEAD):");
  console.warn(dirty.split("\n").map((l) => "    " + l).join("\n"));
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });

const baseTar = path.join(DIST, "_base.tar");
sh("git", ["archive", "--format=tar", "-o", baseTar, "HEAD"]);

const envFor = (role) => `# darkside — pinned to the ${role.toUpperCase()} machine.\nNEXT_PUBLIC_DARKSIDE_ROLE=${role}\nDARKSIDE_ROLE=${role}\n`;

function operatorReadme(role) {
  const other = role === "yoda" ? "vader" : "yoda";
  const common = `# darkside · ${role.toUpperCase()} machine

This zip is pinned to the **${role}** role (\`NEXT_PUBLIC_DARKSIDE_ROLE=${role}\` in \`.env\`).

## Install & run (localhost)
\`\`\`bash
npm ci
npm run build
npm start            # http://localhost:3000  (PORT=… to change)
\`\`\`
Requires Node ≥ 20.11. No Python/venv. See README.md for details.
`;
  if (role === "yoda") {
    return (
      common +
      `
## Your part of the e2e (Yoda = static / mission control)
1. **Diagnostics** → Run diagnostics (self-check is green).
2. **Queue** → pick a case → **Install & Decompile** (or **Escalate** if below gate). The static agent arms.
3. **Agent** → dispatch Sky Walker manually; mark it done (real agent reports via the API).
4. **Bridge** → **Export evidence/mission bundle** → you get \`darkbridge-mission-*.json\`.
5. **Carry that file to the ${other} machine** (USB / AirDrop) and import it there.
6. When ${other} sends the evidence bundle back, **Bridge → Import** it here, then reconcile → score.
`
    );
  }
  return (
    common +
    `
## Your part of the e2e (Vader = dynamic lab)
1. **Diagnostics → Run dynamic preflight** — confirm HTTP Toolkit + NordVPN + a connected rooted device (mandatory) are alive. See docs/DYNAMIC-SETUP.md.
2. Receive the \`darkbridge-mission-*.json\` from the ${other} machine → **Bridge → Import**.
3. **Vader** → run the dynamic experiments → evidence is captured.
4. **Bridge → Export evidence bundle** → \`darkbridge-evidence-*.json\`.
5. **Carry that file back to the ${other} machine** and import it there to reconcile.
`
  );
}

const PRIVATE = /\.(xlsx|xls)$|riskware_chains|riskware_rubrics|\/riskware\/riskware\/|flow_graph\./i;

for (const role of ROLES) {
  const name = `darkside-${role}`;
  const dir = path.join(STAGE, name);
  mkdirSync(dir, { recursive: true });
  sh("tar", ["-xf", baseTar, "-C", dir]);
  writeFileSync(path.join(dir, ".env"), envFor(role));
  writeFileSync(path.join(dir, "OPERATOR-README.md"), operatorReadme(role));

  const zip = path.join(DIST, `${name}.zip`);
  sh("zip", ["-rqX", zip, name], { cwd: STAGE });

  // SAFETY: refuse to emit a zip that contains any private artifact.
  const listing = sh("unzip", ["-Z1", zip]);
  const leaked = listing.split("\n").filter((f) => PRIVATE.test(f));
  if (leaked.length) {
    rmSync(zip, { force: true });
    console.error(`✗ ABORT: ${name}.zip contained private files:\n` + leaked.map((f) => "    " + f).join("\n"));
    process.exit(1);
  }
  const kb = Math.round(statSync(zip).size / 1024);
  console.log(`✓ dist/${name}.zip  (${kb} KB)  role=${role}  — private-clean`);
}

rmSync(baseTar, { force: true });
rmSync(STAGE, { recursive: true, force: true });
console.log("\nNext: copy each zip to its machine, then follow its OPERATOR-README.md. Guide: docs/DEPLOY-ZIPS.md");
