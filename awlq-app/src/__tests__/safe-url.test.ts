import { describe, expect, it } from "vitest";
import { parseSafeExternalUrl } from "@/lib/safe-url";
import { extractReferenceLinks } from "@/lib/reference-links";

describe("safe external URLs", () => {
  it.each(["//evil.example", "/relativo", "mailto:a@b.com", "javascript:alert(1)", "data:text/html,x", ""]) ("rejects %s", (href) => expect(parseSafeExternalUrl(href)).toBeNull());
  it("classifies AWS using the parsed hostname", () => {
    expect(parseSafeExternalUrl("https://docs.aws.amazon.com/x")?.isAws).toBe(true);
    expect(parseSafeExternalUrl("https://docs.aws.amazon.com.evil.example")?.isAws).toBe(false);
    expect(parseSafeExternalUrl("https://evil.com/?x=aws.amazon.com")?.isAws).toBe(false);
  });
  it("keeps link validation in the ExternalLink component", () => {
    expect(parseSafeExternalUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("extractReferenceLinks", () => {
  it("extracts and deduplicates the final reference footer", () => {
    expect(extractReferenceLinks("Corpo\n**Referências AWS:** https://docs.aws.amazon.com/a. https://example.com/x"))
      .toEqual({ body: "Corpo", references: [
        { href: "https://docs.aws.amazon.com/a", hostname: "docs.aws.amazon.com", label: "AWS Docs" },
        { href: "https://example.com/x", hostname: "example.com", label: "example.com" },
      ] });
  });
});
