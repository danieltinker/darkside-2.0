import type { FlowGraph } from "./contract";

// =====================================================================
// The one IOC: mmp_cloaking (strong = 8).
//
// The true affiliate URL never appears in static strings. It is built at
// runtime from a tracker response (HTTP → parse → base64+XOR deobfuscate)
// and loaded into a WebView through obfuscated indirection (coroutine →
// native libcloak.so → loadUrl). This graph is what Yoda authors and
// embeds in the MissionContext; static_confirmed flags are set (Yoda
// located every node). native_file.confirmed_active stays false here —
// only Vader can flip it at runtime.
// =====================================================================

// The cleartext the deobf node recovers — also the runtime found_url.
export const AFFILIATE_URL =
  "https://go.offerwall-aff.net/r?o=8821&aff=adtrack&sub=mmp";

export const mmpCloakingGraph: FlowGraph = {
  entry: "n1_callback",
  required_nodes: ["n1_callback", "n2_parse", "n3_load"],
  nodes: [
    // ---- Stage 1 · Trigger ----------------------------------------
    {
      node_id: "n1_callback",
      phase: "acquisition",
      boundary: "acquisition_signal",
      behavioral_role: "attribution_payload_entry",
      stage: 1,
      label: "onConversionDataSuccess",
      kind: "trigger",
      static_confirmed: true,
      frida_hook: "com.adtrack.attr.AttribListener.onConversionDataSuccess",
      signature: {
        class_name: "com.adtrack.attr.AttribListener",
        method: "onConversionDataSuccess(java.util.Map)",
        file_path: "sources/com/adtrack/attr/AttribListener.java",
        line: 42,
        snippet:
          "public void onConversionDataSuccess(Map<String, Object> data) {\n" +
          '    String tok = String.valueOf(data.get("af_adset"));\n' +
          "    a.invoke(data);          // hand off to URL builder\n" +
          "}",
      },
    },

    // ---- Stage 2 · URL build --------------------------------------
    {
      node_id: "n2_invoke",
      phase: "url_build",
      boundary: null,
      behavioral_role: "runtime_url_builder",
      stage: 2,
      label: "a.invoke(data)",
      kind: "dispatch",
      static_confirmed: true,
      frida_hook: "com.adtrack.core.a.invoke",
      signature: {
        class_name: "com.adtrack.core.a",
        method: "invoke(java.util.Map)",
        file_path: "sources/com/adtrack/core/a.java",
        line: 18,
        snippet:
          "final void invoke(Map data) {\n" +
          '    String r  = g(String.valueOf(data.get("af_adset")));\n' +
          '    String dl = new JSONObject(r).optString("dl");\n' +
          "    String url = B64.dec(dl);   // deobfuscate → cleartext\n" +
          "    MainActivity.o(url);        // hand to sink\n" +
          "}",
      },
    },
    {
      node_id: "n2_http",
      phase: "url_build",
      boundary: null,
      behavioral_role: "remote_destination_resolution",
      stage: 2,
      label: "a.g(token) — tracker GET",
      kind: "http",
      static_confirmed: true,
      frida_hook: "com.adtrack.core.a.g",
      signature: {
        class_name: "com.adtrack.core.a",
        method: "g(java.lang.String)",
        file_path: "sources/com/adtrack/core/a.java",
        line: 33,
        snippet:
          "String g(String t) {\n" +
          "    Request rq = new Request.Builder()\n" +
          '        .url("https://t.adtrack-cdn.com/c?ref=" + t).build();\n' +
          "    return client.newCall(rq).execute().body().string();\n" +
          "}",
      },
    },
    {
      node_id: "n2_parse",
      phase: "url_build",
      boundary: "destination_resolution",
      behavioral_role: "attribution_field_extraction",
      stage: 2,
      label: 'JSONObject.optString("dl")',
      kind: "parse",
      static_confirmed: true,
      frida_hook: "org.json.JSONObject.optString",
      signature: {
        class_name: "org.json.JSONObject",
        method: "optString(java.lang.String)",
        file_path: "sources/com/adtrack/core/a.java",
        line: 20,
        snippet:
          'String dl = new JSONObject(r).optString("dl");\n' +
          '// dl = "S0NmW1tdQ0pYW0..." (base64, XOR-wrapped — not the URL yet)',
      },
    },
    {
      node_id: "n2_deobf",
      phase: "url_build",
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

    // ---- Stage 3 · Sink -------------------------------------------
    {
      node_id: "n3_o",
      phase: "sink",
      boundary: null,
      behavioral_role: "browser_container_setup",
      stage: 3,
      label: "MainActivity.o(url)",
      kind: "dispatch",
      static_confirmed: true,
      frida_hook: "com.app.MainActivity.o",
      signature: {
        class_name: "com.app.MainActivity",
        method: "o(java.lang.String)",
        file_path: "sources/com/app/MainActivity.java",
        line: 210,
        snippet:
          "public final void o(String url) {\n" +
          "    new Cloak(this).c(url);    // launch cloak coroutine\n" +
          "}",
      },
    },
    {
      node_id: "n3_coro",
      phase: "sink",
      boundary: null,
      behavioral_role: "dispatch_indirection",
      stage: 3,
      label: "Cloak$block$1.invokeSuspend",
      kind: "dispatch",
      static_confirmed: true,
      frida_hook: "com.app.Cloak$c$1.invokeSuspend",
      signature: {
        class_name: "com.app.Cloak$c$1",
        method: "invokeSuspend(java.lang.Object)",
        file_path: "sources/com/app/Cloak$c$1.java",
        line: 27,
        snippet:
          "public final Object invokeSuspend(Object $result) {\n" +
          "    // coroutine indirection hides the sink call site\n" +
          "    Cloak.nativeDispatch(this.$url);   // → JNI\n" +
          "    return Unit.INSTANCE;\n" +
          "}",
      },
    },
    {
      node_id: "n3_native",
      phase: "sink",
      boundary: null,
      behavioral_role: "native_dispatch",
      stage: 3,
      label: "libcloak.so JNI dispatch",
      kind: "dispatch",
      static_confirmed: true,
      frida_hook: "com.app.Cloak.nativeDispatch",
      signature: {
        class_name: "com.app.Cloak",
        method: "nativeDispatch(java.lang.String)",
        file_path: "sources/com/app/Cloak.java",
        line: 64,
        snippet:
          "private static native void nativeDispatch(String url);\n" +
          "// resolves to Java_com_app_Cloak_nativeDispatch in libcloak.so\n" +
          "// native code re-enters Java and calls render(url)",
      },
      native_file: {
        native_id: "nf_libcloak_8821",
        name: "libcloak.so",
        sha256:
          "9f2c1ab4e7d3056b8c41fa92de77b0c5a3e1488f6b2d90147ca5e0b3f8d62719",
        exported_symbol: "Java_com_app_Cloak_nativeDispatch",
        confirmed_active: false, // static only knows it exists; Vader proves it
        activity_note: "native dispatch present in lib; runtime execution unproven",
      },
    },
    {
      node_id: "n3_load",
      phase: "sink",
      boundary: "render",
      behavioral_role: "in_app_destination_render",
      stage: 3,
      label: "WebView.loadUrl(url)",
      kind: "sink",
      static_confirmed: true,
      frida_hook: "android.webkit.WebView.loadUrl",
      signature: {
        class_name: "android.webkit.WebView",
        method: "loadUrl(java.lang.String)",
        file_path: "sources/com/app/Cloak.java",
        line: 88,
        snippet:
          "// native callback re-enters Java here:\n" +
          "void render(String url) {\n" +
          "    this.webView.loadUrl(url);   // the real sink\n" +
          "}",
      },
    },
  ],
  edges: [
    { from: "n1_callback", to: "n2_invoke", relation: "calls" },
    { from: "n2_invoke", to: "n2_http", relation: "calls" },
    { from: "n2_http", to: "n2_parse", relation: "returns" },
    { from: "n2_parse", to: "n2_deobf", relation: "data_to" },
    { from: "n2_deobf", to: "n2_invoke", relation: "returns" },
    { from: "n2_invoke", to: "n3_o", relation: "data_to" },
    { from: "n3_o", to: "n3_coro", relation: "calls" },
    { from: "n3_coro", to: "n3_native", relation: "calls" },
    { from: "n3_native", to: "n3_load", relation: "triggers" },
  ],
};
