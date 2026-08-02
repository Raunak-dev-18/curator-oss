import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantMessageContent } from "./message-content";

describe("AssistantMessageContent", () => {
  it("renders GitHub-flavored Markdown", () => {
    const html = renderToStaticMarkup(
      createElement(AssistantMessageContent, {
        content: "## Changed\n\n- **Updated** `app/page.tsx`\n\n| Check | Result |\n| --- | --- |\n| Build | Passed |",
      }),
    );
    expect(html).toContain("<h2>Changed</h2>");
    expect(html).toContain("<strong>Updated</strong>");
    expect(html).toContain("<code>app/page.tsx</code>");
    expect(html).toContain("<table>");
  });

  it("does not render raw HTML or unsafe link protocols", () => {
    const html = renderToStaticMarkup(
      createElement(AssistantMessageContent, {
        content: '<script>alert("x")</script> [unsafe](javascript:alert(1))',
      }),
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });
});
