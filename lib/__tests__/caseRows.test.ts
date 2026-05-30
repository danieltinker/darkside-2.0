import { describe, it, expect } from "vitest";
import { buildCaseRows } from "@/lib/caseRows";
import { caseQueue } from "@/lib/cases";
import { loadChains } from "@/lib/gems/loadGem";

describe("case queue", () => {
  const rows = buildCaseRows();

  it("every confirmed_chain_id resolves to a real chain in its rubric (no drift)", () => {
    for (const c of caseQueue) {
      const ids = new Set(loadChains(c.rubric_id).chains.map((x) => x.chain_id));
      for (const cid of c.confirmed_chain_ids) {
        expect(ids, `${c.case_id} → ${cid}`).toContain(cid);
      }
    }
  });

  it("scores are the binary-per-chain sum of confirmed chains' points", () => {
    for (const row of rows) {
      const expected = row.chains.filter((c) => c.confirmed).reduce((s, c) => s + c.points, 0);
      expect(row.score).toBe(expected);
    }
  });

  it("the golden MMP case is traced and scores strong 8", () => {
    const mmp = rows.find((r) => r.case_id === "case_mmp_8821")!;
    expect(mmp.traced).toBe(true);
    expect(mmp.status).toBe("scored");
    expect(mmp.score).toBe(8);
  });

  it("device-info accumulates medium+weak with no strong anchor (root+emulator+adb+battery = 10)", () => {
    const dev = rows.find((r) => r.case_id === "case_dev_5512")!;
    expect(dev.score).toBe(10); // 2 + 2 + 2 + 4
    expect(dev.chains.some((c) => c.strength === "strong")).toBe(false);
  });

  it("a genuine sub-threshold partial exists (0 < score < 8)", () => {
    const partial = rows.find((r) => r.status === "partial");
    expect(partial, "expected at least one partial case").toBeTruthy();
    expect(partial!.score).toBeGreaterThan(0);
    expect(partial!.score).toBeLessThan(8);
  });

  it("verdict matches the 8-pt threshold (scored≥8, 0<partial<8, fp=0) — payload not required", () => {
    const THRESHOLD = 8;
    for (const row of rows) {
      if (row.status === "scored") expect(row.score, row.case_id).toBeGreaterThanOrEqual(THRESHOLD);
      if (row.status === "partial") {
        expect(row.score, row.case_id).toBeGreaterThan(0);
        expect(row.score, row.case_id).toBeLessThan(THRESHOLD);
      }
      if (row.status === "fp") expect(row.score, row.case_id).toBe(0);
    }
  });

  it("the device-info case clears the threshold without a payload (score 10 → scored TP)", () => {
    const dev = rows.find((r) => r.case_id === "case_dev_5512")!;
    expect(dev.status).toBe("scored");
    expect(dev.score).toBe(10);
  });

  it("running cases score 0", () => {
    expect(rows.find((r) => r.case_id === "case_rt_7740")!.score).toBe(0);
    expect(rows.find((r) => r.case_id === "case_url_9102")!.score).toBe(0);
  });
});
