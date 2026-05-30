import { z } from "zod";

// A chain is a weighted SIGNAL (from the riskware source-of-truth spreadsheet).
// strength → points: strong=8, medium=4, weak=2, non_signal=0. Scored binary per
// chain. A detailed flow graph is OPTIONAL enrichment (required_boundaries/
// required_nodes present only for fully-traced chains like the MMP webview one);
// most chains are signal-level (name + strength) until a graph is authored.
export const ChainSchema = z.object({
  chain_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  strength: z.enum(["strong", "medium", "weak", "non_signal"]),
  points: z.union([z.literal(8), z.literal(4), z.literal(2), z.literal(0)]),
  score_mode: z.literal("all_or_nothing"),
  required_boundaries: z.array(z.string()).optional(),
  required_nodes: z.array(z.string()).optional(),
});
export type Chain = z.infer<typeof ChainSchema>;

export const FlexibleMatchSchema = z.object({
  examples: z.array(z.string()),
  match_type: z.string(),
});

const DecryptorSchema = z.object({
  algorithm: z.enum(["base64", "xor", "aes", "rc4", "custom"]),
  key_source: z.string(),
  decrypted_strings: z.array(
    z.object({
      ciphertext: z.string(),
      plaintext: z.string(),
      note: z.string().optional(),
    })
  ),
});

const NativeFileSchema = z.object({
  native_id: z.string(),
  name: z.string(),
  sha256: z.string(),
  exported_symbol: z.string().optional(),
  confirmed_active: z.boolean(),
  activity_note: z.string(),
});

export const GemNodeSchema = z.object({
  node_id: z.string(),
  stage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  phase: z.string(),
  boundary: z.string().nullable().optional(),
  behavioral_role: z.string().optional(),
  label: z.string(),
  kind: z.enum(["trigger", "dispatch", "http", "parse", "deobf", "sink"]),
  static_confirmed: z.boolean(),
  frida_hook: z.string(),
  produces_url: z.boolean().optional(),
  flexible_match: FlexibleMatchSchema.optional(),
  decryptor: DecryptorSchema.optional(),
  native_file: NativeFileSchema.optional(),
  signature: z.object({
    class_name: z.string(),
    method: z.string(),
    file_path: z.string(),
    line: z.number(),
    snippet: z.string(),
  }),
});
export type GemNode = z.infer<typeof GemNodeSchema>;

export const GemEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  relation: z.enum(["calls", "returns", "data_to", "triggers"]),
});

export const GraphGemSchema = z.object({
  graph_id: z.string(),
  rubric_id: z.string(),
  schema_version: z.string(),
  entry: z.string(),
  required_nodes: z.array(z.string()),
  nodes: z.array(GemNodeSchema),
  edges: z.array(GemEdgeSchema),
});
export type GraphGem = z.infer<typeof GraphGemSchema>;

export const ChainsFileSchema = z.object({
  rubric_id: z.string(),
  chains_version: z.string(),
  chains: z.array(ChainSchema),
});

export const CategorySchema = z.object({
  category_id: z.string(),
  name: z.string(),
  version: z.string(),
  status: z.string(),
  dispatch_gate: z.object({ metadata_score_gte: z.number() }),
  scoring_model: z.object({
    strong: z.number(),
    medium: z.number(),
    weak: z.number(),
    confirmed_tp_threshold: z.number(),
  }),
  rubrics: z.array(
    z.object({
      rubric_id: z.string(),
      status: z.string(),
      skywalker_gem: z.string(),
    })
  ),
});
export type Category = z.infer<typeof CategorySchema>;
