import type {
  CaseIdentity,
  QueueLock,
  MissionContext,
  EvidenceReturn,
  NodeEvidence,
  NativeFile,
  ExtractedPayload,
  KnownRiskwareUrl,
  Artifact,
} from "./contract";
import { mmpCloakingGraph, AFFILIATE_URL } from "./flow";
import { stampMission, stampEvidence } from "./bridge";
import { checksumHex } from "./util";
import { domainOf, normalizeUrl } from "./known-urls";

// =====================================================================
// The one golden case. Source of truth for the MVP (no DB).
// com.coinflip.rewards runs MMP attribution cloaking: the affiliate URL is
// built at runtime from a tracker response and loaded through coroutine +
// native indirection. Yoda confirmed all 9 static nodes; Vader confirmed
// the 3 boundaries (and every sub-step) dynamically → strong 8.
// =====================================================================

export const MISSION_ID = "m_8821";

export const caseIdentity: CaseIdentity = {
  case_id: "case_mmp_8821",
  package_name: "com.coinflip.rewards",
  version_code: 184,
  version_name: "3.4.1",
  developer: "Nimbus Rewards Ltd.",
  top_countries: ["BR", "ID", "IN", "VN", "NG"],
};

export const queueLock: QueueLock = {
  lock_id: "QL-7F3A91",
  case_id: caseIdentity.case_id,
  locked_by: "yoda",
  locked_at: "2026-05-29T07:55:00Z",
  expires_at: "2026-05-29T09:55:00Z",
};

// ---- Renderable artifact content (mock-only; keyed by Artifact.path) ----
// Kept out of the Artifact contract type on purpose. The EvidenceViewer reads
// content by path — simulating "rendering from the stored artifact".
export type FridaContent = { kind: "frida"; lines: string[] };
export type HttpContent = {
  kind: "http";
  method: string;
  url: string;
  reqHeaders: Record<string, string>;
  status: number;
  statusText: string;
  respHeaders: Record<string, string>;
  respBody: string;
};
export type ShotContent = { kind: "screenshot"; src: string; caption: string };
export type ArtifactContent = FridaContent | HttpContent | ShotContent;

export const artifactContent: Record<string, ArtifactContent> = {};

// ---- Artifact builders (register content + return the contract Artifact) ----
function frida(node: string, label: string, lines: string[]): Artifact {
  const path = `bridge/artifacts/${MISSION_ID}/frida/${node}.log`;
  artifactContent[path] = { kind: "frida", lines };
  return { kind: "frida", path, sha256: checksumHex(path + lines.join("\n")), label };
}
function http(node: string, label: string, c: Omit<HttpContent, "kind">): Artifact {
  const path = `bridge/artifacts/${MISSION_ID}/http/${node}.har`;
  artifactContent[path] = { kind: "http", ...c };
  return { kind: "http", path, sha256: checksumHex(path + c.url + c.respBody), label };
}
function shot(node: string, label: string, src: string, caption: string): Artifact {
  const path = `bridge/artifacts/${MISSION_ID}/screenshots/${node}.png`;
  artifactContent[path] = { kind: "screenshot", src, caption };
  return { kind: "screenshot", path, sha256: checksumHex(path + src), label };
}

// ---- Per-node dynamic evidence (Vader) — 11-node traced graph ----------
// Two experiments were run: an Organic control (→ benign decoy) and a
// Non-organic uncloak (→ affiliate WebView). Together they PROVE the cloak gate.
export const nodeEvidence: NodeEvidence[] = [
  {
    node_id: "n1_launch",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: "AdsApplication.onCreate fired; Tracker.boot() initialized attribution before any UI.",
    artifacts: [
      frida("n1_launch", "Application.onCreate hook", [
        "[+] Attached to pid 14233 (com.coinflip.rewards)",
        "[Frida] Hooking com.coinflip.rewards.AdsApplication.onCreate",
        "[launch] super.onCreate(); Tracker.boot(this)",
      ]),
    ],
  },
  {
    node_id: "n2_sdk_init",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: "AppsFlyer SDK initialized with the attribution listener wired in.",
    artifacts: [
      frida("n2_sdk_init", "AppsFlyerLib.init hook", [
        "[Frida] Hooking com.appsflyer.AppsFlyerLib.init",
        '[init] devKey="aF_dev_key" listener=com.adtrack.attr.AttribListener',
        "[init] start(context)",
      ]),
    ],
  },
  {
    node_id: "n3_listener",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: "An async AppsFlyerConversionListener (AttribListener) is registered to receive attribution.",
    artifacts: [
      frida("n3_listener", "listener registration", [
        "[Frida] com.adtrack.core.Tracker.<clinit>",
        "[listener] AppsFlyerConversionListener = com.adtrack.attr.AttribListener@1f",
      ]),
    ],
  },
  {
    node_id: "n4_callback",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: "onConversionDataSuccess fired; attribution map entered app logic (boundary: acquisition signal).",
    artifacts: [
      frida("n4_callback", "onConversionDataSuccess hook", [
        "[Frida] Hooking com.adtrack.attr.AttribListener.onConversionDataSuccess",
        "[cb] data = {af_status=Non-organic, af_adset=af_adset_9183, campaign=mmp_q2, media_source=offerwall}",
        "[cb] -> a.invoke(data)",
      ]),
    ],
  },
  {
    node_id: "n5_unpack",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: 'a.invoke read af_status="Non-organic" and the af_adset token, then called gate().',
    artifacts: [
      frida("n5_unpack", "field extraction hook", [
        "[Frida] Hooking com.adtrack.core.a.invoke",
        '[invoke] af_status = "Non-organic"',
        '[invoke] af_adset  = "af_adset_9183"',
        "[invoke] -> gate(status, tok)",
      ]),
    ],
  },
  {
    node_id: "n6_gate",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation:
      'CLOAK GATE proven both ways: af_status=="Non-organic" → uncloak; the Organic control took the benign branch.',
    artifacts: [
      frida("n6_gate", "gate() branch decision (both experiments)", [
        "[Frida] Hooking com.adtrack.core.a.gate",
        '[exp:non_organic] gate(status="Non-organic") -> TRUE  -> MainActivity.o(B64.dec(...))   // UNCLOAK',
        '[exp:organic]     gate(status="Organic")     -> FALSE -> MainActivity.benign()          // DECOY',
        "[+] destination behavior is gated by acquisition metadata — cloaking confirmed",
      ]),
    ],
  },
  {
    node_id: "n7a_benign",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: "Under the Organic control, the app showed a benign arcade UI (the decoy) — no WebView load.",
    artifacts: [
      frida("n7a_benign", "benign branch (Organic control)", [
        "[exp:organic] [Frida] com.app.MainActivity.benign()",
        "[exp:organic] setContentView(R.layout.activity_game)",
        "[exp:organic] no WebView.loadUrl observed",
      ]),
      shot(
        "n7a_benign",
        "benign decoy (Organic control)",
        "/screenshots/geo_baseline.svg",
        "Organic install → harmless arcade screen",
      ),
    ],
  },
  {
    node_id: "n7b_synth",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: `B64.dec unwrapped the tracker blob to the cleartext affiliate URL: ${AFFILIATE_URL}`,
    artifacts: [
      frida("n7b_synth", "B64.dec hook (cleartext recovered)", [
        "[Frida] Hooking com.adtrack.util.B64.dec",
        '[B64.dec] in  = "S0NmW1tdQ0pYW0FUX0ZRXl5dQ0pYW0FUX0ZR"',
        "[B64.dec] key = KEY[16] @ B64.<clinit>",
        `[B64.dec] out = "${AFFILIATE_URL}"`,
      ]),
    ],
  },
  {
    node_id: "n8_resolve",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: 'Tracker GET returned 200; the "dl" field carries the base64+XOR-wrapped URL (boundary: destination resolution).',
    artifacts: [
      http("n8_resolve", "tracker GET / response", {
        method: "GET",
        url: "https://t.adtrack-cdn.com/c?ref=af_adset_9183",
        reqHeaders: {
          "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 13; Pixel 6)",
          "X-Sdk": "adtrack/6.12.1",
          Accept: "application/json",
        },
        status: 200,
        statusText: "OK",
        respHeaders: { "Content-Type": "application/json", "Cache-Control": "no-store", Server: "cloudfront" },
        respBody: JSON.stringify(
          {
            status: "ok",
            cid: 9183,
            dl: "S0NmW1tdQ0pYW0FUX0ZRXl5dQ0pYW0FUX0ZR",
            ttl: 3600,
            fallback: "https://play.google.com/store/apps/details?id=com.coinflip.rewards",
          },
          null,
          2,
        ),
      }),
    ],
  },
  {
    node_id: "n9_container",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: "WebView prepared with JavaScript enabled before the load.",
    artifacts: [
      frida("n9_container", "WebView container prep", [
        "[Frida] Hooking android.webkit.WebSettings.setJavaScriptEnabled",
        "[container] setJavaScriptEnabled(true)",
        "[container] full-screen WebView attached",
      ]),
    ],
  },
  {
    node_id: "n10_load",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: "WebView.loadUrl rendered the affiliate offer page with the cleartext URL (boundary: render).",
    artifacts: [
      frida("n10_load", "WebView.loadUrl hook", [
        "[Frida] Hooking android.webkit.WebView.loadUrl",
        `[loadUrl] url = "${AFFILIATE_URL}"`,
        "[loadUrl] thread=main activity=com.app.MainActivity",
        "[+] affiliate page rendered (screenshot captured)",
      ]),
      shot(
        "n10_load",
        "rendered affiliate page",
        "/screenshots/mmp_affiliate.svg",
        "go.offerwall-aff.net — cloaked offer rendered in-app",
      ),
    ],
  },
];

// No native module in this chain (the source blueprint has no JNI path).
export const nativeFiles: NativeFile[] = [];

// ---- Extracted payload (dropper found during the uncloak run) ----------
export const extractedPayloads: ExtractedPayload[] = [
  {
    payload_id: "pl_dropper_8821",
    type: "dropper",
    source_path_on_device: "/data/data/com.coinflip.rewards/files/.cl/cd.bin",
    storage_path: "/payloads/cloak_dropper.bin",
    sha256: checksumHex("cloak_dropper.bin"),
    size_bytes: 53124,
    found_at_node: "n7b_synth",
    description:
      "Second-stage dropper written during the uncloak branch; drops a DEX into the app private dir and loads it via DexClassLoader (see the runtime_loading_of_code rubric).",
  },
];

export const foundUrls: string[] = [AFFILIATE_URL];

// ---- The two contract messages, stamped ------------------------------
export const missionContext: MissionContext = stampMission({
  schema_version: "1.0.0",
  type: "MissionContext",
  mission_id: MISSION_ID,
  sent_by: "yoda",
  sent_to: "darth_vader",
  case_identity: caseIdentity,
  queue_lock: queueLock,
  rubric: {
    category_id: "riskware",
    rubric_id: "attribution_gated_webview_uncloaking",
    chain_id: "attribution_gated_webview_uncloaking_strong_8",
    name: "Attribution-Gated WebView Uncloaking",
    points_if_strong: 8,
    gem_version: "0.1.0",
  },
  flow: mmpCloakingGraph,
  status: "MISSION_SENT",
  created_at: "2026-05-29T08:02:00Z",
});

export const evidenceReturn: EvidenceReturn = stampEvidence({
  schema_version: "1.0.0",
  type: "EvidenceReturn",
  mission_id: MISSION_ID,
  sent_by: "darth_vader",
  sent_to: "yoda",
  case_id: caseIdentity.case_id,
  node_evidence: nodeEvidence,
  native_files: nativeFiles,
  extracted_payloads: extractedPayloads,
  found_urls: foundUrls,
  iterations: 3,
  dynamic_confirmed: true,
  dynamic_score: 8,
  verdict: "confirmed_tp",
  created_at: "2026-05-29T08:14:00Z",
});

// ---- Known-riskware-URL seed -----------------------------------------
// The domain go.offerwall-aff.net is already known from two prior missions
// (different paths) → domain corroboration fires on this case. The exact
// o=8821 URL is NEW, so on confirmed_tp the write-back adds it (+1 URL),
// demonstrating both O(1) lookup and corpus growth.
export const knownUrlSeed: KnownRiskwareUrl[] = [
  {
    url: normalizeUrl("https://go.offerwall-aff.net/r?o=5120&aff=spinpush"),
    domain: "go.offerwall-aff.net",
    first_seen_mission_id: "m_5512",
    package_name: "com.luckyspin.cash",
    added_at: "2026-04-18T09:12:00Z",
    hits: 5,
  },
  {
    url: normalizeUrl("https://go.offerwall-aff.net/r?o=7740&aff=adtrack"),
    domain: "go.offerwall-aff.net",
    first_seen_mission_id: "m_6033",
    package_name: "com.dailyscratch.win",
    added_at: "2026-05-02T14:40:00Z",
    hits: 2,
  },
];

export const AFFILIATE_DOMAIN = domainOf(AFFILIATE_URL);
