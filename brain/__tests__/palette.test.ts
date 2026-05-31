import { describe, it, expect } from "vitest";
import { KIND_STYLE, RELATION_TONE, STRENGTH_CHIP } from "@/brain/palette";

const KINDS = ["trigger","dispatch","http","parse","deobf","sink","condition","benign_branch","assessment","verdict"];
const RELATIONS = ["calls","returns","data_to","triggers","initializes","registers","async_triggers","branch_benign","branch_uncloaked","resolves_or_requests","destination_to_container","loads"];
const STRENGTHS = ["strong","medium","weak","non_signal"];

describe("palette", () => {
  it("styles every node kind", () => {
    for (const k of KINDS) expect(KIND_STYLE[k as keyof typeof KIND_STYLE]).toBeTruthy();
    expect(Object.keys(KIND_STYLE)).toHaveLength(10);
  });
  it("tones every edge relation", () => {
    for (const r of RELATIONS) expect(RELATION_TONE[r as keyof typeof RELATION_TONE]).toBeTruthy();
    expect(Object.keys(RELATION_TONE)).toHaveLength(12);
  });
  it("chips every strength", () => {
    for (const s of STRENGTHS) expect(STRENGTH_CHIP[s as keyof typeof STRENGTH_CHIP]).toBeTruthy();
    expect(Object.keys(STRENGTH_CHIP)).toHaveLength(4);
  });
});
