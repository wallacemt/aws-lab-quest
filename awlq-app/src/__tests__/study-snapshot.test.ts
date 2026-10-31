import { describe, expect, it } from "vitest";
import {
  projectSnapshotForViewer,
  readJsonWithBodyLimit,
  sanitizeSnapshotItem,
} from "@/lib/study-snapshot";

describe("study snapshot security helpers", () => {
  it("drops items without a valid question id and rejects oversized fields", () => {
    expect(sanitizeSnapshotItem({ questionId: " " }).item).toBeNull();
    expect(sanitizeSnapshotItem({ questionId: "q1", statement: "x".repeat(4097) }).error).toBe("statement");
    expect(sanitizeSnapshotItem({ questionId: "q1", options: { A: "x".repeat(1025) } }).error).toBe("options.A");
    expect(sanitizeSnapshotItem({ questionId: "q1", explanations: { A: "x".repeat(4097) } }).error).toBe("explanations.A");
    expect(sanitizeSnapshotItem({ questionId: "q1", explanationSummary: "x".repeat(8193) }).error).toBe("explanationSummary");
  });

  it("normalizes behavioral fields and projects them only for public viewers", () => {
    const result = sanitizeSnapshotItem({
      questionId: "q1",
      timeSpentSeconds: 90000.4,
      confidence: "bogus",
      markedForReview: 1,
    });
    expect(result.item).toMatchObject({ timeSpentSeconds: 86400, confidence: null, markedForReview: false });

    const items = [{ questionId: "q1", timeSpentSeconds: 12, confidence: "low", markedForReview: true }];
    expect(projectSnapshotForViewer(items, "owner")).toEqual(items);
    expect(projectSnapshotForViewer(items, "admin")).toEqual(items);
    expect(projectSnapshotForViewer(items, "public")).toEqual([{ questionId: "q1" }]);
  });

  it("rejects bodies over the one megabyte limit by actual byte length", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(1024 * 1024) }),
    });
    expect(await readJsonWithBodyLimit(request)).toEqual({ body: null, error: "too-large" });
  });
});
