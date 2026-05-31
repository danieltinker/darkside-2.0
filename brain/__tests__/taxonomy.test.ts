import { describe, it, expect } from "vitest";
import {
  RISKWARE_TAXONOMY,
  TAXONOMY_RUBRIC_COUNT,
  TAXONOMY_SIGNAL_COUNT,
} from "@/brain/data/riskwareTaxonomy";
import type { Strength } from "@/brain/types";

describe("riskware taxonomy", () => {
  it("has 10 rubrics and 44 signals", () => {
    expect(TAXONOMY_RUBRIC_COUNT).toBe(10);
    expect(RISKWARE_TAXONOMY).toHaveLength(10);
    expect(TAXONOMY_SIGNAL_COUNT).toBe(44);
    const total = RISKWARE_TAXONOMY.reduce((n, r) => n + r.signals.length, 0);
    expect(total).toBe(44);
  });

  it("matches the Summary-sheet strength tallies", () => {
    const tally: Record<Strength, number> = { strong: 0, medium: 0, weak: 0, non_signal: 0 };
    for (const r of RISKWARE_TAXONOMY) for (const s of r.signals) tally[s.strength]++;
    expect(tally).toEqual({ strong: 13, medium: 11, weak: 19, non_signal: 1 });
  });

  it("has unique signal ids and non-empty names", () => {
    const ids = RISKWARE_TAXONOMY.flatMap((r) => r.signals.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RISKWARE_TAXONOMY)
      for (const s of r.signals) expect(s.name.length).toBeGreaterThan(0);
  });

  it("has the expected per-rubric signal counts", () => {
    const counts = Object.fromEntries(RISKWARE_TAXONOMY.map((r) => [r.id, r.signals.length]));
    expect(counts).toMatchObject({
      attribution_gated_webview_uncloaking: 5,
      install_referrer_cloaking: 1,
      runtime_loading_of_code: 5,
      geolocation_cloaking: 6,
      arbitrary_obfuscated_url_loading: 10,
      network_information_cloaking: 5,
      device_info_cloaking: 9,
      time_cloaking: 1,
      command_and_control: 1,
      partial_uncloaking: 1,
    });
  });
});
