import { describe, expect, it } from "vitest";
import { chronoKey, sessionsUpTo, sortChronological } from "../src/lib/sessions";
import { applyDownloadEvent, EMPTY_DOWNLOAD_RESPONSE, pendingCountOf } from "../src/lib/download-progress";

describe("sessions", () => {
  it("runs from the current year back to 2017", () => {
    const list = sessionsUpTo(2026);
    expect(list[0]).toBe("W2026");
    expect(list.at(-1)).toBe("S2017");
    expect(list).toHaveLength(20);
    expect(sessionsUpTo()[0]).toBe(`W${new Date().getFullYear()}`);
  });
  it("orders chronologically: summer before winter in a year", () => {
    expect(sortChronological(["W2024", "S2025", "S2024", "W2018"])).toEqual(["W2018", "S2024", "W2024", "S2025"]);
    expect(chronoKey("S2024")).toBeLessThan(chronoKey("W2024"));
  });
});

describe("progress", () => {
  it("does not count merged rows as probes", () => {
    let d = applyDownloadEvent(EMPTY_DOWNLOAD_RESPONSE, { type: "start", totalPdfs: 3 });
    d = applyDownloadEvent(d, { type: "file", file: { filename: "a", format: "single", course: "BE", subject: "X", session: "S2024" } });
    d = applyDownloadEvent(d, { type: "file", file: { filename: "m", format: "merge-all", course: "BE", subject: "X", sources: ["a"] } });
    expect(d.successCount).toBe(1);
    expect(pendingCountOf(d)).toBe(2);
  });

  it("start resets files, failures and counters", () => {
    let d = applyDownloadEvent(EMPTY_DOWNLOAD_RESPONSE, { type: "start", totalPdfs: 2 });
    d = applyDownloadEvent(d, {
      type: "file",
      file: { filename: "a", format: "single", course: "BE", subject: "X", session: "S2024" },
    });
    d = applyDownloadEvent(d, { type: "unavailable", entry: "X_W2024" });

    d = applyDownloadEvent(d, { type: "start", totalPdfs: 5 });

    expect(d.files).toEqual([]);
    expect(d.failed).toEqual([]);
    expect(d.successCount).toBe(0);
    expect(d.totalPdfs).toBe(5);
  });

  it("done replaces the running counters with final values", () => {
    let d = applyDownloadEvent(EMPTY_DOWNLOAD_RESPONSE, { type: "start", totalPdfs: 9 });
    d = applyDownloadEvent(d, {
      type: "done",
      successCount: 7,
      totalPdfs: 9,
      processingTime: "1.2s",
    });

    expect(d.successCount).toBe(7);
    expect(d.totalPdfs).toBe(9);
    expect(d.processingTime).toBe("1.2s");
    // No rows landed in this synthetic case, so all 9 probes still look pending.
    expect(pendingCountOf(d)).toBe(9);
  });

  it("treats unavailable entries as settled", () => {
    let d = applyDownloadEvent(EMPTY_DOWNLOAD_RESPONSE, { type: "start", totalPdfs: 2 });
    d = applyDownloadEvent(d, { type: "unavailable", entry: "X_W2024" });

    expect(d.failed).toEqual(["X_W2024"]);
    expect(pendingCountOf(d)).toBe(1);
  });

  it("never reports a negative pending count", () => {
    expect(pendingCountOf(null)).toBe(0);
    expect(pendingCountOf(EMPTY_DOWNLOAD_RESPONSE)).toBe(0);

    const overDone = {
      ...EMPTY_DOWNLOAD_RESPONSE,
      totalPdfs: 1,
      failed: ["a", "b"],
    };
    expect(pendingCountOf(overDone)).toBe(0);
  });
});
