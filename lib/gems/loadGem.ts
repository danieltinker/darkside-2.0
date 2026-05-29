import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import {
  GraphGemSchema,
  ChainsFileSchema,
  CategorySchema,
  type GraphGem,
  type Category,
} from "./types";

const ROOT = process.cwd();
const GEMS = path.join(ROOT, "gems");

function readYaml(rel: string): unknown {
  return parse(readFileSync(path.join(GEMS, rel), "utf8"));
}

export function loadGraphGem(rubricId: string): GraphGem {
  const raw = readYaml(`riskware/rubrics/${rubricId}/graph.yaml`);
  return GraphGemSchema.parse(raw);
}

export function loadChains(rubricId: string) {
  const raw = readYaml(`riskware/rubrics/${rubricId}/chains.yaml`);
  return ChainsFileSchema.parse(raw);
}

export function loadCategory(categoryId: string): Category {
  const raw = readYaml(`${categoryId}/category.yaml`);
  return CategorySchema.parse(raw);
}

