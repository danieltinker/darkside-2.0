import { seedKnownUrls } from "./known-urls";
import { knownUrlSeed } from "./mock";

// Seed the known-riskware-URL DB once per bundle. Idempotent; called
// synchronously before any reconcile() so URL lookups are populated.
let done = false;
export function ensureSeeded(): void {
  if (done) return;
  seedKnownUrls(knownUrlSeed);
  done = true;
}
