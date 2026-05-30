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

  it("device-info partial case accumulates medium+weak with no strong (root+emulator+adb+battery = 10)", () => {
    const dev = rows.find((r) => r.case_id === "case_dev_5512")!;
    expect(dev.status).toBe("partial");
    expect(dev.score).toBe(10); // 2 + 2 + 2 + 4
    expect(dev.chains.some((c) => c.strength === "strong")).toBe(false);
  });

  it("running / fp / locked cases score 0", () => {
    for (const id of ["case_rt_7740", "case_url_9102", "case_dev_4410"]) {
      expect(rows.find((r) => r.case_id === id)!.score).toBe(0);
    }
  });
});
