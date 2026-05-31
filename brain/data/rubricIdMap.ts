import type { Provenance } from "@/brain/types";

export interface RubricIdEntry {
  id: string;          // stable rubric_id used across the board
  provenance: Provenance;
}

// Keyed by the exact "Category" cell text in docs/riskware_rubrics_processed.xlsx.
export const RUBRIC_ID_MAP: Record<string, RubricIdEntry> = {
  "MMP cloaking": { id: "attribution_gated_webview_uncloaking", provenance: "gem" },
  "Install Referrer cloaking": { id: "install_referrer_cloaking", provenance: "spec_only" },
  "Runtime loading of code": { id: "runtime_loading_of_code", provenance: "gem" },
  "Geolocation cloaking": { id: "geolocation_cloaking", provenance: "spec_only" },
  "Arbitrary or obfuscated URL loading": { id: "arbitrary_obfuscated_url_loading", provenance: "gem" },
  "Network information cloaking": { id: "network_information_cloaking", provenance: "spec_only" },
  "Device info cloaking": { id: "device_info_cloaking", provenance: "gem" },
  "Time cloaking": { id: "time_cloaking", provenance: "spec_only" },
  "Command And Control": { id: "command_and_control", provenance: "gem" },
  "Partial uncloaking": { id: "partial_uncloaking", provenance: "spec_only" },
};

export const GEM_RUBRIC_IDS: string[] = Object.values(RUBRIC_ID_MAP)
  .filter((r) => r.provenance === "gem")
  .map((r) => r.id);
