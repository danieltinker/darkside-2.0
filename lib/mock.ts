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
import { mmpCloakingGraph, IOC, AFFILIATE_URL } from "./flow";
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
const NATIVE_SHA256 =
  "9f2c1ab4e7d3056b8c41fa92de77b0c5a3e1488f6b2d90147ca5e0b3f8d62719";

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

// ---- Per-node dynamic evidence (Vader) ---------------------------------
export const nodeEvidence: NodeEvidence[] = [
  {
    node_id: "n1_callback",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: "onConversionDataSuccess fired; af_adset token captured and handed to a.invoke().",
    artifacts: [
      frida("n1_callback", "onConversionDataSuccess hook", [
        "[+] Attached to pid 14233 (com.coinflip.rewards)",
        "[Frida] Hooking com.adtrack.attr.AttribListener.onConversionDataSuccess",
        "[cb] data = {af_status=Non-organic, af_adset=af_adset_9183, campaign=mmp_q2, media_source=offerwall}",
        '[cb] af_adset token => "af_adset_9183"',
        "[cb] -> a.invoke(data)",
      ]),
    ],
  },
  {
    node_id: "n2_invoke",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: "a.invoke orchestrated the build: GET → optString(dl) → B64.dec → MainActivity.o(url).",
    artifacts: [
      frida("n2_invoke", "a.invoke trace", [
        "[Frida] Hooking com.adtrack.core.a.invoke",
        "[invoke] entered with Map(7)",
        '[invoke] g("af_adset_9183") -> 412-byte JSON',
        '[invoke] optString("dl") -> "S0NmW1tdQ0pYW0FUX0ZRXl5dQ0pYW0FUX0ZR"',
        `[invoke] B64.dec(dl) -> "${AFFILIATE_URL}"`,
        "[invoke] MainActivity.o(url)",
      ]),
    ],
  },
  {
    node_id: "n2_http",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: 'Tracker GET returned 200; the "dl" field carries the base64+XOR-wrapped URL (not in static strings).',
    artifacts: [
      http("n2_http", "tracker GET / response", {
        method: "GET",
        url: "https://t.adtrack-cdn.com/c?ref=af_adset_9183",
        reqHeaders: {
          "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 13; Pixel 6)",
          "X-Sdk": "adtrack/6.12.1",
          Accept: "application/json",
        },
        status: 200,
        statusText: "OK",
        respHeaders: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Server: "cloudfront",
        },
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
    node_id: "n2_parse",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: 'optString("dl") pulled the wrapped blob out of the tracker JSON.',
    artifacts: [
      frida("n2_parse", "JSONObject.optString hook", [
        "[Frida] Hooking org.json.JSONObject.optString",
        '[optString] key="dl" -> "S0NmW1tdQ0pYW0FUX0ZRXl5dQ0pYW0FUX0ZR"',
        "[optString] (value is base64+XOR — not yet a URL)",
      ]),
    ],
  },
  {
    node_id: "n2_deobf",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: `B64.dec unwrapped the blob to the cleartext affiliate URL: ${AFFILIATE_URL}`,
    artifacts: [
      frida("n2_deobf", "B64.dec hook (cleartext recovered)", [
        "[Frida] Hooking com.adtrack.util.B64.dec",
        '[B64.dec] in  = "S0NmW1tdQ0pYW0FUX0ZRXl5dQ0pYW0FUX0ZR"',
        "[B64.dec] key = KEY[16] @ B64.<clinit>",
        `[B64.dec] out = "${AFFILIATE_URL}"`,
      ]),
    ],
  },
  {
    node_id: "n3_o",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: "MainActivity.o received the cleartext URL and launched the Cloak coroutine.",
    artifacts: [
      frida("n3_o", "MainActivity.o hook", [
        "[Frida] Hooking com.app.MainActivity.o",
        `[o] url = "${AFFILIATE_URL}"`,
        "[o] new Cloak(this).c(url)",
      ]),
    ],
  },
  {
    node_id: "n3_coro",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: "Cloak coroutine resumed and dispatched into the native layer.",
    artifacts: [
      frida("n3_coro", "Cloak$c$1.invokeSuspend hook", [
        "[Frida] Hooking com.app.Cloak$c$1.invokeSuspend",
        "[coro] resumed label=1 $url=<cleartext>",
        "[coro] -> Cloak.nativeDispatch($url)",
      ]),
    ],
  },
  {
    node_id: "n3_native",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: "libcloak.so loaded; JNI export executed with the cleartext URL — native path CONFIRMED ACTIVE.",
    artifacts: [
      frida("n3_native", "libcloak.so JNI dispatch", [
        "[Frida] Module loaded: libcloak.so base=0x7b41c00000 size=0x21000",
        `[Frida] sha256(libcloak.so) = ${NATIVE_SHA256.slice(0, 16)}…  (matches static)`,
        "[Frida] Hooking export Java_com_app_Cloak_nativeDispatch",
        `[native] arg0(jstring) = "${AFFILIATE_URL}"`,
        "[native] JNIEnv->CallVoidMethod(render, url)",
        "[+] native path CONFIRMED ACTIVE",
      ]),
    ],
  },
  {
    node_id: "n3_load",
    reconfirmed_static: true,
    dynamic_status: "confirmed",
    observation: "WebView.loadUrl rendered the affiliate offer page with the cleartext URL.",
    artifacts: [
      frida("n3_load", "WebView.loadUrl hook", [
        "[Frida] Hooking android.webkit.WebView.loadUrl",
        `[loadUrl] url = "${AFFILIATE_URL}"`,
        "[loadUrl] thread=main activity=com.app.MainActivity",
        "[+] affiliate page rendered (screenshot captured)",
      ]),
      shot(
        "n3_load",
        "rendered affiliate page",
        "/screenshots/mmp_affiliate.svg",
        "go.offerwall-aff.net — cloaked offer rendered in-app",
      ),
    ],
  },
];

// ---- Native file (Vader's confirmed version) ---------------------------
export const nativeFiles: NativeFile[] = [
  {
    native_id: "nf_libcloak_8821",
    name: "libcloak.so",
    sha256: NATIVE_SHA256,
    exported_symbol: "Java_com_app_Cloak_nativeDispatch",
    confirmed_active: true,
    activity_note:
      "module loaded at 0x7b41c00000; export executed with cleartext URL; sha256 matches static analysis.",
  },
];

// ---- Extracted payload (dropper found at runtime) ----------------------
export const extractedPayloads: ExtractedPayload[] = [
  {
    payload_id: "pl_dropper_8821",
    type: "dropper",
    source_path_on_device: "/data/data/com.coinflip.rewards/files/.cl/cd.bin",
    storage_path: "/payloads/cloak_dropper.bin",
    sha256: checksumHex("cloak_dropper.bin"),
    size_bytes: 53124,
    found_at_node: "n3_native",
    description:
      "Second-stage dropper written by libcloak.so on first cloak dispatch; drops a DEX into the app private dir and loads it via DexClassLoader.",
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
  ioc: { ioc_id: IOC.ioc_id, name: IOC.name, points_if_strong: IOC.points_if_strong },
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
