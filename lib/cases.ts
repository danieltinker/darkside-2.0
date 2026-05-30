import type { CaseIdentity } from "./contract";
import { caseIdentity as goldenIdentity, MISSION_ID } from "./mock";

// =====================================================================
// Case queue — the multi-package roster Yoda works through.
//
// One case is FULLY TRACED (the golden MMP case → /yoda /vader with a real
// flow graph + dynamic evidence). The rest are SIGNAL-LEVEL: Yoda has decided
// which of the rubric's chains fired (`confirmed_chain_ids`); the case score
// is the binary-per-chain sum of those confirmed chains' points. No traced
// graph is authored for them yet — honest about the altitude.
//
// This module is client-safe (plain data). The Queue page joins it with the
// real chain metadata from the gem files server-side (see lib/caseRows.ts).
// =====================================================================

// Verdict rule (confirmed_tp_threshold = 8): a case is a confirmed TP the moment
// its binary-per-chain score reaches 8 — reaching a final payload is NOT required.
// "partial" is reserved for a real, sub-threshold result (0 < score < 8).
export type QueueStatus =
  | "scored" // confirmed TP — score ≥ 8 (no payload required)
  | "partial" // confirmed signals but total below the 8-pt threshold (0 < score < 8)
  | "fp" // static suspicion not reproduced → failed, score 0
  | "running" // Vader running experiments
  | "locked" // locked from the queue, not yet started
  | "below_gate"; // metadata score < dispatch gate → closed early (human can escalate)

// GATE-1 dispatch threshold (mirrors gems/riskware/category.yaml dispatch_gate).
// A case below this is "below_gate" and Sky Walker isn't auto-dispatched —
// a human can override via the Install & Decompile button (gate escalation).
export const METADATA_DISPATCH_GATE = 8;

export type CaseRecord = {
  case_id: string;
  identity: CaseIdentity;
  category_id: string;
  rubric_id: string;
  rubric_name: string; // display name (not loaded from gem to stay client-safe)
  metadata_score: number; // GATE-1 routing score (≥8 dispatches Sky Walker)
  status: QueueStatus;
  confirmed_chain_ids: string[]; // which of the rubric's chains Yoda confirmed
  traced?: boolean; // golden case → links to the full /yoda /vader experience
  mission_id?: string;
  note?: string;
};

export const caseQueue: CaseRecord[] = [
  {
    case_id: "case_mmp_8821",
    identity: goldenIdentity,
    category_id: "riskware",
    rubric_id: "attribution_gated_webview_uncloaking",
    rubric_name: "MMP cloaking — attribution-gated WebView uncloaking",
    metadata_score: 11,
    status: "scored",
    confirmed_chain_ids: ["attribution_gated_webview_uncloaking_strong_8"],
    traced: true,
    mission_id: MISSION_ID,
    note: "Fully-traced golden case — static↔dynamic chain proven across the cloak gate.",
  },
  {
    case_id: "case_dev_5512",
    identity: {
      case_id: "case_dev_5512",
      package_name: "com.luckyspin.cash",
      version_code: 512,
      version_name: "5.1.2",
      developer: "BrightByte Studios",
      top_countries: ["BR", "MX", "ID"],
    },
    category_id: "riskware",
    rubric_id: "device_info_cloaking",
    rubric_name: "Device info cloaking",
    metadata_score: 9,
    status: "scored",
    confirmed_chain_ids: [
      "device_info_cloaking__root_detection",
      "device_info_cloaking__emulator_detection",
      "device_info_cloaking__adb_enabled_detection",
      "device_info_cloaking__battery_percentage",
    ],
    note: "Anti-analysis evasion confirmed (root/emulator/adb/battery) → score 10. 10 ≥ 8 = confirmed TP; reaching a final payload is NOT required to confirm.",
  },
  {
    case_id: "case_c2_6033",
    identity: {
      case_id: "case_c2_6033",
      package_name: "com.dailyscratch.win",
      version_code: 341,
      version_name: "3.4.1",
      developer: "Nimbus Rewards Ltd.",
      top_countries: ["IN", "VN", "NG"],
    },
    category_id: "riskware",
    rubric_id: "command_and_control",
    rubric_name: "Command & Control",
    metadata_score: 10,
    status: "scored",
    confirmed_chain_ids: [
      "command_and_control__known_riskware_urls_a_url_is_considered_known_riskwa",
    ],
    note: "Reused a known riskware URL (go.offerwall-aff.net) seen in prior missions — strong 8.",
  },
  {
    case_id: "case_rt_7740",
    identity: {
      case_id: "case_rt_7740",
      package_name: "com.tapblitz.go",
      version_code: 88,
      version_name: "0.8.8",
      developer: "Pixel Frenzy Inc.",
      top_countries: ["ID", "PH", "TH"],
    },
    category_id: "riskware",
    rubric_id: "runtime_loading_of_code",
    rubric_name: "Runtime loading of code",
    metadata_score: 8,
    status: "running",
    confirmed_chain_ids: [],
    note: "Vader is running experiments — DexClassLoader hook armed.",
  },
  {
    case_id: "case_url_9102",
    identity: {
      case_id: "case_url_9102",
      package_name: "com.arcade.spinx",
      version_code: 220,
      version_name: "2.2.0",
      developer: "Loop Arcade",
      top_countries: ["US", "GB"],
    },
    category_id: "riskware",
    rubric_id: "arbitrary_obfuscated_url_loading",
    rubric_name: "Arbitrary / obfuscated URL loading",
    metadata_score: 8,
    status: "fp",
    confirmed_chain_ids: [],
    note: "Static suspicion not reproduced at runtime — failed FP, score 0.",
  },
  {
    case_id: "case_dev_4410",
    identity: {
      case_id: "case_dev_4410",
      package_name: "com.megawin.cash",
      version_code: 130,
      version_name: "1.3.0",
      developer: "GoldTap Mobile",
      top_countries: ["BR", "CO", "PE"],
    },
    category_id: "riskware",
    rubric_id: "device_info_cloaking",
    rubric_name: "Device info cloaking",
    metadata_score: 12,
    status: "partial",
    confirmed_chain_ids: [
      "device_info_cloaking__root_detection",
      "device_info_cloaking__emulator_detection",
      "device_info_cloaking__touch_count",
    ],
    note: "Three weak evasion signals confirmed (root/emulator/touch = 6) — below the 8-pt TP threshold, so this is a genuine partial, not a confirmed TP.",
  },
  {
    case_id: "case_url_4471",
    identity: {
      case_id: "case_url_4471",
      package_name: "com.puzzle.dailyhop",
      version_code: 64,
      version_name: "0.6.4",
      developer: "Hopscotch Games",
      top_countries: ["US", "CA", "AU"],
    },
    category_id: "riskware",
    rubric_id: "arbitrary_obfuscated_url_loading",
    rubric_name: "Arbitrary / obfuscated URL loading",
    metadata_score: 5,
    status: "below_gate",
    confirmed_chain_ids: [],
    note: "Metadata score 5 < gate 8 — closed early, Sky Walker not auto-dispatched. A reviewer can escalate (Install & Decompile) to force a static review anyway.",
  },
];
