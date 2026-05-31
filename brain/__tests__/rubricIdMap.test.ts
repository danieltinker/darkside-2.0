import { describe, it, expect } from "vitest";
import { RUBRIC_ID_MAP, GEM_RUBRIC_IDS } from "@/brain/data/rubricIdMap";

describe("rubricIdMap", () => {
  it("has all 10 spreadsheet rubrics", () => {
    expect(Object.keys(RUBRIC_ID_MAP)).toHaveLength(10);
  });

  it("marks exactly 5 rubrics as gem-backed", () => {
    const gem = Object.values(RUBRIC_ID_MAP).filter((r) => r.provenance === "gem");
    expect(gem).toHaveLength(5);
    expect(GEM_RUBRIC_IDS).toEqual(
      expect.arrayContaining([
        "attribution_gated_webview_uncloaking",
        "runtime_loading_of_code",
        "arbitrary_obfuscated_url_loading",
        "device_info_cloaking",
        "command_and_control",
      ]),
    );
    expect(GEM_RUBRIC_IDS).toHaveLength(5);
  });

  it("maps MMP cloaking to the attribution rubric id", () => {
    expect(RUBRIC_ID_MAP["MMP cloaking"].id).toBe("attribution_gated_webview_uncloaking");
  });
});
