import { describe, it, expect, vi } from "vitest";

// extractJsonObject is pure, but @/lib/ai transitively imports @/lib/prisma
// via ai-config.ts, which throws at import time without DATABASE_URL.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { extractJsonObject } from "@/lib/ai";

describe("extractJsonObject", () => {
  it("extracts a clean JSON object embedded in surrounding text", () => {
    expect(extractJsonObject('Here you go:\n{"a":1}\nEnjoy')).toBe('{"a":1}');
  });

  it("strips a trailing comma before a closing bracket or brace (common LLM slip)", () => {
    const withTrailingCommas = '{"questions":[{"a":1},{"b":2},]}';
    const parsed = JSON.parse(extractJsonObject(withTrailingCommas)!);
    expect(parsed.questions).toHaveLength(2);
  });

  it("returns null when there is no JSON object in the text", () => {
    expect(extractJsonObject("no braces here")).toBeNull();
  });
});
