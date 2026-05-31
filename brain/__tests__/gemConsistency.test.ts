import { describe, it, expect } from "vitest";
import { RISKWARE_TAXONOMY } from "@/brain/data/riskwareTaxonomy";
import { GEM_RUBRIC_IDS } from "@/brain/data/rubricIdMap";
import { loadChains } from "@/lib/gems/loadGem";

// normalize: compare the SET of (name, strength) pairs, order-independent.
function pairKey(name: string, strength: string) {
  return `${name.trim()}::${strength}`;
}

describe("gem ↔ spreadsheet consistency", () => {
  for (const rubricId of GEM_RUBRIC_IDS) {
    it(`${rubricId}: gem chains.yaml matches the taxonomy`, () => {
      const taxon = RISKWARE_TAXONOMY.find((r) => r.id === rubricId);
      expect(taxon, `taxonomy missing ${rubricId}`).toBeDefined();

      const gemChains = loadChains(rubricId).chains;
      const gemSet = new Set(gemChains.map((c) => pairKey(c.name, c.strength)));
      const taxonSet = new Set(taxon!.signals.map((s) => pairKey(s.name, s.strength)));

      expect(gemChains.length).toBe(taxon!.signals.length);
      expect([...gemSet].sort()).toEqual([...taxonSet].sort());
    });
  }
});
