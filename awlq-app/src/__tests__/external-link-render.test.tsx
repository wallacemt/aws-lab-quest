import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExternalLink } from "@/components/rich-text/ExternalLink";

function renderLink(href: string) {
  return renderToStaticMarkup(<ExternalLink href={href}>texto</ExternalLink>);
}

describe("ExternalLink rendering", () => {
  // Guards against a regression where ExternalLink trusts href directly and
  // stops calling parseSafeExternalUrl before creating an anchor.
  it.each(["javascript:alert(1)", "//evil.example/login", "/relativo"])(
    "does not create an anchor for unsafe URL %s",
    (href) => {
      expect(renderLink(href)).not.toContain("<a");
    },
  );

  it("renders a safe AWS documentation link with its label", () => {
    const html = renderLink("https://docs.aws.amazon.com/foo");

    expect(html).toContain('<a href="https://docs.aws.amazon.com/foo"');
    expect(html).toContain("AWS Docs");
  });

  it("does not label a lookalike hostname as AWS documentation", () => {
    expect(renderLink("https://docs.aws.amazon.com.evil.example/foo")).not.toContain("AWS Docs");
  });
});
