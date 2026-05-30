// =====================================================================
// darkside — Cross-machine contract (THE central interface)
//
// Two typed messages travel over PixelBridge: Yoda → Vader (MissionContext)
// and Vader → Yoda (EvidenceReturn). These shapes are LAW. Neither machine
// reads the other's internals; they exchange only these messages + artifacts.
// The transport is mocked for the MVP, but the shapes below are what a real
// two-machine build would honor unchanged.
// =====================================================================

// ---- Shared identity (minimal) -------------------------------------
export type CaseIdentity = {
  case_id: string; // stable per investigation
  package_name: string; // primary real-world identity
  version_code: number;
  version_name: string;
  developer: string;
  top_countries: string[]; // geo-targeting hint
};

export type QueueLock = {
  lock_id: string; // QueueLockID
  case_id: string;
  locked_by: "yoda";
  locked_at: string; // ISO
  expires_at: string; // lease, not permanent
};

// ---- The static call graph (authored by Yoda) ----------------------
export type NodeSignature = {
  class_name: string; // fully-qualified
  method: string; // e.g. g(java.lang.String)
  file_path: string; // exact decompiled path (no cross-machine gaps)
  line: number;
  snippet: string; // focal decompiled lines
};

// Static analysis may provide a decryptor for a node. When decryption is
// part of the call-trace, the node surfaces the decryptor + the recovered
// strings so reviewers see the cleartext that was hidden.
export type Decryptor = {
  algorithm: "base64" | "xor" | "aes" | "rc4" | "custom";
  key_source: string; // where the key/seed comes from
  decrypted_strings: { ciphertext: string; plaintext: string; note?: string }[];
};

// Native .so referenced by an obfuscated dispatch node. Tracked by name +
// a stable unique id; confirmed_active flips true when Vader proves the
// native path actually ran.
export type NativeFile = {
  native_id: string; // stable unique id
  name: string; // e.g. libcloak.so
  sha256: string;
  exported_symbol?: string; // JNI entry the dispatch calls
  confirmed_active: boolean; // dynamic proved it executed
  activity_note: string;
};

export type NodeKind =
  | "trigger"
  | "dispatch"
  | "http"
  | "parse"
  | "deobf"
  | "sink"
  | "condition" // the cloaking gate (branches benign vs uncloak)
  | "benign_branch" // decoy/normal UI shown when the gate is not satisfied
  | "assessment" // analysis step (AST / dynamic validation)
  | "verdict"; // final rubric mark

export type FlowNode = {
  node_id: string;
  stage?: 1 | 2 | 3; // legacy coarse stage; banding now uses `phase`
  label: string;
  kind: NodeKind;
  signature?: NodeSignature; // optional: blueprint/meta nodes carry no per-app code
  frida_hook: string; // exact hook target Vader will set
  static_confirmed: boolean; // Yoda located it in decompiled code
  produces_url?: boolean; // the node whose output is the affiliate URL (drives known-URL lookup)
  decryptor?: Decryptor; // present on deobf/decrypt nodes
  native_file?: NativeFile; // present on native dispatch nodes
  behavioral_role?: string;
  phase?: string;
  boundary?: string | null; // scoring boundary this node serves
  flexible_match?: { examples: string[]; match_type: string };
};

export type EdgeRelation =
  | "calls"
  | "returns"
  | "data_to"
  | "triggers"
  | "initializes"
  | "registers"
  | "async_triggers"
  | "branch_benign"
  | "branch_uncloaked"
  | "resolves_or_requests"
  | "destination_to_container"
  | "loads";

export type FlowEdge = {
  from: string;
  to: string;
  relation: EdgeRelation;
  label?: string; // branch condition, e.g. "af_status == Non-organic"
};

export type FlowGraph = {
  entry: string; // node_id
  nodes: FlowNode[];
  edges: FlowEdge[];
  required_nodes: string[]; // boundary nodes that gate the strong-8 score
};

// ---- MESSAGE A→B : Yoda hands the mission to Vader -----------------
export type MissionContext = {
  schema_version: "1.0.0";
  type: "MissionContext";
  mission_id: string;
  sent_by: "yoda";
  sent_to: "darth_vader";
  case_identity: CaseIdentity;
  queue_lock: QueueLock;
  rubric: {
    category_id: string;
    rubric_id: string;
    chain_id: string;
    name: string;
    points_if_strong: 8 | 4 | 2;
    gem_version: string;
  };
  dynamic_aids?: {
    frida_hooks?: { node_id: string; target: string }[];
    mock_responses?: { label: string; when: string; payload: unknown }[];
    decryptors?: Decryptor[];
  };
  flow: FlowGraph; // with Yoda's static_confirmed flags set
  status: MissionStatus;
  created_at: string;
  checksum: string; // sha256 of payload
};

// ---- Dynamic evidence Vader attaches per node ----------------------
export type Artifact = {
  kind: "frida" | "http" | "screenshot";
  path: string;
  sha256: string;
  label: string;
};

export type DynamicStatus = "confirmed" | "failed" | "pending";

export type NodeEvidence = {
  node_id: string;
  reconfirmed_static: boolean; // Vader re-located the signature locally
  dynamic_status: DynamicStatus;
  artifacts: Artifact[]; // frida logs / http logs / screenshots
  observation: string; // one-line what-we-saw
};

// Extracted payload — if Vader finds a dropper/packer at runtime it pulls
// it off the device into storage and returns a downloadable handle.
export type ExtractedPayload = {
  payload_id: string;
  type: "dropper" | "packer" | "dex" | "so" | "apk";
  source_path_on_device: string;
  storage_path: string; // under bridge/artifacts/<mission_id>/payloads/
  sha256: string;
  size_bytes: number;
  found_at_node?: string; // which graph node surfaced it
  description: string;
};

export type Verdict = "confirmed_tp" | "failed_fp" | "partial";

// ---- MESSAGE B→A : Vader returns the evidence ----------------------
export type EvidenceReturn = {
  schema_version: "1.0.0";
  type: "EvidenceReturn";
  mission_id: string;
  sent_by: "darth_vader";
  sent_to: "yoda";
  case_id: string;
  node_evidence: NodeEvidence[];
  native_files: NativeFile[]; // with confirmed_active set by Vader
  extracted_payloads: ExtractedPayload[]; // droppers/packers found (may be empty)
  found_urls: string[]; // affiliate URLs observed at runtime
  iterations: number; // experiment iterations Vader ran
  dynamic_confirmed: boolean; // all required_nodes confirmed
  dynamic_score: number; // 8 if confirmed, else partial/0
  verdict: Verdict;
  created_at: string;
  checksum: string;
};

// ---- Human-in-the-loop (Yoda reconcile) ----------------------------
// The reviewer confirms the trace and may flip the verdict; the score
// auto-updates from the flip.
export type NodeConfirmation = "confirmed" | "rejected";

export type HumanReview = {
  reviewer: string;
  trace_confirmed: boolean; // human agrees the static↔dynamic chain holds
  node_confirmations: Record<string, NodeConfirmation>; // per-node human call
  verdict_override?: Verdict;
  score_after_override?: number; // auto-derived: 8 for confirmed_tp, 0 for failed_fp, partial computed
  reason?: string;
  at: string;
};

// ---- Mission lifecycle (lean) --------------------------------------
export type MissionStatus =
  | "LOCKED" // Yoda: locked from queue, identity created
  | "STATIC_CONFIRMED" // Yoda: all 3 static stages located
  | "MISSION_SENT" // pushed to PixelBridge (A→B)
  | "RECEIVED" // Vader imported MissionContext
  | "DYNAMIC_RUNNING" // Vader running experiments
  | "EVIDENCE_SENT" // Vader pushed EvidenceReturn (B→A)
  | "SCORED"; // Yoda reconciled → strong 8 (or partial/fail)

// ---- Known-riskware-URL DB record ----------------------------------
export type KnownRiskwareUrl = {
  url: string; // normalized
  domain: string;
  first_seen_mission_id: string;
  package_name: string;
  added_at: string;
  hits: number; // times re-observed
};
