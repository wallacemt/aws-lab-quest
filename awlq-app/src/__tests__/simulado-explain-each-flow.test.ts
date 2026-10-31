import { describe, expect, it } from "vitest";
import { resolvePrimaryAction } from "@/features/study/components/simulado/primary-action";

describe("EXPLAIN_EACH primary action", () => {
  const resolve = (overrides: Partial<Parameters<typeof resolvePrimaryAction>[0]> = {}) =>
    resolvePrimaryAction({
      reviewEachAnswer: true,
      submitted: false,
      confirmed: false,
      isLast: false,
      ...overrides,
    });

  it("confirms once and advances on the next click", () => {
    expect(resolve()).toBe("confirm");
    expect(resolve({ confirmed: true })).toBe("advance");
  });

  it("opens the pre-submit summary for the last confirmed question", () => {
    expect(resolve({ confirmed: true, isLast: true })).toBe("show-summary");
  });

  it("keeps normal exam navigation and submission behavior", () => {
    expect(resolve({ reviewEachAnswer: false })).toBe("advance");
    expect(resolve({ reviewEachAnswer: false, isLast: true })).toBe("submit");
    expect(resolve({ reviewEachAnswer: false, submitted: true, isLast: true })).toBe("advance");
  });
});
