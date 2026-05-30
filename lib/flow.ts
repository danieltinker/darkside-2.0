import type { FlowGraph } from "./contract";

// =====================================================================
// The traced MMP-cloaking graph for the golden case (com.coinflip.rewards).
//
// This is the per-case INSTANTIATION of the canonical behavioral blueprint
// `gems/riskware/blueprints/onConversionDataSucces.graph.yaml`: lifecycle +
// MMP setup → conversion callback → field extraction → CLOAK GATE (Organic →
// benign decoy / Non-organic → uncloak) → runtime URL synthesis → remote
// resolution → WebView render. Unlike the blueprint (role-only), the traced
// graph carries per-app decompiled signatures. The blueprint's assessment /
// verdict nodes (N11–13) are realized by the reconcile scoring footer.
//
// required_nodes are the 4 scoring boundaries; all must be dynamically
// confirmed for the strong-8.
// =====================================================================

// The cleartext the synthesis node recovers — also the runtime found_url.
export const AFFILIATE_URL =
  "https://go.offerwall-aff.net/r?o=8821&aff=adtrack&sub=mmp";

export const mmpCloakingGraph: FlowGraph = {
  entry: "n1_launch",
  required_nodes: ["n4_callback", "n6_gate", "n8_resolve", "n10_load"],
  nodes: [
    // ---- Phase 1 · Lifecycle & MMP SDK setup ----------------------
    {
      node_id: "n1_launch",
      phase: "lifecycle",
      boundary: null,
      behavioral_role: "lifecycle_entry",
      stage: 1,
      label: "Application.onCreate",
      kind: "trigger",
      static_confirmed: true,
      frida_hook: "com.coinflip.rewards.AdsApplication.onCreate",
      signature: {
        class_name: "com.coinflip.rewards.AdsApplication",
        method: "onCreate()",
        file_path: "sources/com/coinflip/rewards/AdsApplication.java",
        line: 31,
        snippet:
          "public void onCreate() {\n" +
          "    super.onCreate();\n" +
          "    Tracker.boot(this);      // sets up MMP + attribution\n" +
          "}",
      },
    },
    {
      node_id: "n2_sdk_init",
      phase: "lifecycle",
      boundary: null,
      behavioral_role: "attribution_sdk_initialization",
      stage: 1,
      label: "AppsFlyerLib.init",
      kind: "dispatch",
      static_confirmed: true,
      frida_hook: "com.appsflyer.AppsFlyerLib.init",
      flexible_match: {
        examples: ["AppsFlyerLib.getInstance().init", "Adjust.onCreate", "Branch.getAutoInstance"],
        match_type: "semantic_or_api_family",
      },
      signature: {
        class_name: "com.adtrack.core.Tracker",
        method: "boot(android.content.Context)",
        file_path: "sources/com/adtrack/core/Tracker.java",
        line: 18,
        snippet:
          "static void boot(Context c) {\n" +
          '    AppsFlyerLib.getInstance().init("aF_dev_key", listener, c);\n' +
          "    AppsFlyerLib.getInstance().start(c);\n" +
          "}",
      },
    },
    {
      node_id: "n3_listener",
      phase: "lifecycle",
      boundary: null,
      behavioral_role: "listener_registration",
      stage: 1,
      label: "register AttribListener",
      kind: "dispatch",
      static_confirmed: true,
      frida_hook: "com.adtrack.core.Tracker.<clinit>",
      flexible_match: {
        examples: ["AppsFlyerConversionListener", "AdjustAttributionCallback", "BranchReferralInitListener"],
        match_type: "semantic_or_api_family",
      },
      signature: {
        class_name: "com.adtrack.core.Tracker",
        method: "listener: AppsFlyerConversionListener",
        file_path: "sources/com/adtrack/core/Tracker.java",
        line: 11,
        snippet:
          "static final AppsFlyerConversionListener listener =\n" +
          "    new com.adtrack.attr.AttribListener();   // async attribution sink",
      },
    },

    // ---- Phase 2 · Conversion payload extraction ------------------
    {
      node_id: "n4_callback",
      phase: "acquisition",
      boundary: "acquisition_signal",
      behavioral_role: "attribution_payload_entry",
      stage: 1,
      label: "onConversionDataSuccess",
      kind: "trigger",
      static_confirmed: true,
      frida_hook: "com.adtrack.attr.AttribListener.onConversionDataSuccess",
      flexible_match: {
        examples: ["onConversionDataSuccess", "onAttributionChanged", "onInstallReferrerSetupFinished"],
        match_type: "semantic_or_api_family",
      },
      signature: {
        class_name: "com.adtrack.attr.AttribListener",
        method: "onConversionDataSuccess(java.util.Map)",
        file_path: "sources/com/adtrack/attr/AttribListener.java",
        line: 42,
        snippet:
          "public void onConversionDataSuccess(Map<String, Object> data) {\n" +
          "    a.invoke(data);          // hand attribution map to the gate\n" +
          "}",
      },
    },
    {
      node_id: "n5_unpack",
      phase: "acquisition",
      boundary: null,
      behavioral_role: "attribution_field_extraction",
      stage: 1,
      label: 'extract af_status / af_adset',
      kind: "parse",
      static_confirmed: true,
      frida_hook: "com.adtrack.core.a.invoke",
      flexible_match: {
        examples: ["af_status", "media_source", "campaign", "referrer", "deep_link_value"],
        match_type: "fuzzy_key_and_dataflow",
      },
      signature: {
        class_name: "com.adtrack.core.a",
        method: "invoke(java.util.Map)",
        file_path: "sources/com/adtrack/core/a.java",
        line: 18,
        snippet:
          "final void invoke(Map data) {\n" +
          '    String st  = String.valueOf(data.get("af_status"));\n' +
          '    String tok = String.valueOf(data.get("af_adset"));\n' +
          "    gate(st, tok);\n" +
          "}",
      },
    },

    // ---- Phase 3 · Cloaking gateway (the gate + branches) ---------
    {
      node_id: "n6_gate",
      phase: "cloaking_gate",
      boundary: "cloaking_gate",
      behavioral_role: "environment_or_acquisition_gate",
      stage: 2,
      label: "if af_status == Non-organic",
      kind: "condition",
      static_confirmed: true,
      frida_hook: "com.adtrack.core.a.gate",
      flexible_match: {
        examples: ["Non-organic", "Organic", "campaign match", "media_source", "targeted_geo"],
        match_type: "semantic_condition",
      },
      signature: {
        class_name: "com.adtrack.core.a",
        method: "gate(java.lang.String,java.lang.String)",
        file_path: "sources/com/adtrack/core/a.java",
        line: 27,
        snippet:
          "void gate(String status, String tok) {\n" +
          '    if ("Non-organic".equals(status)) {\n' +
          "        MainActivity.o(B64.dec(g(tok)));   // uncloak\n" +
          "    } else {\n" +
          "        MainActivity.benign();             // decoy\n" +
          "    }\n" +
          "}",
      },
    },
    {
      node_id: "n7a_benign",
      phase: "cloaking_gate",
      boundary: null,
      behavioral_role: "decoy_or_normal_ui",
      stage: 2,
      label: "benign arcade UI",
      kind: "benign_branch",
      static_confirmed: true,
      frida_hook: "com.app.MainActivity.benign",
      signature: {
        class_name: "com.app.MainActivity",
        method: "benign()",
        file_path: "sources/com/app/MainActivity.java",
        line: 188,
        snippet:
          "void benign() {\n" +
          "    setContentView(R.layout.activity_game);   // Organic → decoy game\n" +
          "}",
      },
    },

    // ---- Phase 4 · Target URL resolution --------------------------
    {
      node_id: "n7b_synth",
      phase: "url_resolution",
      boundary: null,
      behavioral_role: "runtime_url_builder",
      stage: 2,
      label: "B64.dec(dl) → cleartext URL",
      kind: "deobf",
      static_confirmed: true,
      produces_url: true,
      frida_hook: "com.adtrack.util.B64.dec",
      signature: {
        class_name: "com.adtrack.util.B64",
        method: "dec(java.lang.String)",
        file_path: "sources/com/adtrack/util/B64.java",
        line: 11,
        snippet:
          "static String dec(String s) {\n" +
          "    byte[] b = Base64.decode(s, 0);\n" +
          "    for (int i = 0; i < b.length; i++) b[i] ^= KEY[i % KEY.length];\n" +
          "    return new String(b);    // → cleartext affiliate URL\n" +
          "}",
      },
      decryptor: {
        algorithm: "xor",
        key_source: "static byte[] KEY in B64.<clinit> (base64-decode then XOR)",
        decrypted_strings: [
          {
            ciphertext: "S0NmW1tdQ0pYW0FUX0ZRXl5dQ0pYW0FUX0ZR",
            plaintext: AFFILIATE_URL,
            note: 'value of the "dl" field after base64-decode + XOR unwrap',
          },
          {
            ciphertext: "QFlbX0FUX0ZRXl5dQ0o=",
            plaintext: "go.offerwall-aff.net",
            note: "host extracted from the recovered URL",
          },
        ],
      },
    },
    {
      node_id: "n8_resolve",
      phase: "url_resolution",
      boundary: "destination_resolution",
      behavioral_role: "remote_destination_resolution",
      stage: 2,
      label: "a.g(token) — tracker GET → dl",
      kind: "http",
      static_confirmed: true,
      frida_hook: "com.adtrack.core.a.g",
      flexible_match: {
        examples: ["HTTP 302 Location", "JSON url field", "remote config", "OkHttp", "Retrofit"],
        match_type: "semantic_or_api_family",
      },
      signature: {
        class_name: "com.adtrack.core.a",
        method: "g(java.lang.String)",
        file_path: "sources/com/adtrack/core/a.java",
        line: 33,
        snippet:
          "String g(String t) {\n" +
          '    Request rq = new Request.Builder()\n' +
          '        .url("https://t.adtrack-cdn.com/c?ref=" + t).build();\n' +
          '    String r = client.newCall(rq).execute().body().string();\n' +
          '    return new JSONObject(r).optString("dl");   // base64+XOR blob\n' +
          "}",
      },
    },

    // ---- Phase 5 · WebView render ---------------------------------
    {
      node_id: "n9_container",
      phase: "render",
      boundary: null,
      behavioral_role: "browser_container_setup",
      stage: 3,
      label: "setJavaScriptEnabled(true)",
      kind: "dispatch",
      static_confirmed: true,
      frida_hook: "android.webkit.WebSettings.setJavaScriptEnabled",
      flexible_match: {
        examples: ["setJavaScriptEnabled", "setDomStorageEnabled", "addJavascriptInterface", "WebViewClient"],
        match_type: "semantic_or_api_family",
      },
      signature: {
        class_name: "com.app.MainActivity",
        method: "o(java.lang.String)",
        file_path: "sources/com/app/MainActivity.java",
        line: 210,
        snippet:
          "public final void o(String url) {\n" +
          "    webView.getSettings().setJavaScriptEnabled(true);\n" +
          "    webView.loadUrl(url);   // hand to sink\n" +
          "}",
      },
    },
    {
      node_id: "n10_load",
      phase: "render",
      boundary: "render",
      behavioral_role: "in_app_destination_render",
      stage: 3,
      label: "WebView.loadUrl(url)",
      kind: "sink",
      static_confirmed: true,
      frida_hook: "android.webkit.WebView.loadUrl",
      flexible_match: {
        examples: ["WebView.loadUrl", "WebView.postUrl", "evaluateJavascript", "CustomTabsIntent.launchUrl"],
        match_type: "sink_family",
      },
      signature: {
        class_name: "android.webkit.WebView",
        method: "loadUrl(java.lang.String)",
        file_path: "sources/com/app/MainActivity.java",
        line: 212,
        snippet:
          "webView.loadUrl(url);   // the real sink — renders the affiliate page",
      },
    },
  ],
  edges: [
    { from: "n1_launch", to: "n2_sdk_init", relation: "initializes" },
    { from: "n2_sdk_init", to: "n3_listener", relation: "registers" },
    { from: "n3_listener", to: "n4_callback", relation: "async_triggers" },
    { from: "n4_callback", to: "n5_unpack", relation: "data_to" },
    { from: "n5_unpack", to: "n6_gate", relation: "data_to" },
    { from: "n6_gate", to: "n7a_benign", relation: "branch_benign", label: "af_status == Organic" },
    { from: "n6_gate", to: "n7b_synth", relation: "branch_uncloaked", label: "af_status == Non-organic" },
    { from: "n7b_synth", to: "n8_resolve", relation: "resolves_or_requests" },
    { from: "n8_resolve", to: "n9_container", relation: "destination_to_container" },
    { from: "n9_container", to: "n10_load", relation: "loads" },
  ],
};
