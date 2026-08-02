import { describe, expect, it } from "vitest";
import { createVisualEditBridgeSource, injectVisualEditScriptTag } from "./visual-edit-bridge";

describe("visual edit bridge installation", () => {
  it("adds a managed same-origin script to a Next root layout exactly once", () => {
    const layout = `export default function Layout({ children }) {
  return <html><body>
    {children}
  </body></html>;
}`;
    const first = injectVisualEditScriptTag(layout);
    expect(first).toContain("cognix:visual-edit:start");
    expect(first).toContain('src="/__cognix_visual_edit.js"');
    expect(first?.indexOf("__cognix_visual_edit.js")).toBeLessThan(first?.indexOf("</body>") ?? 0);
    expect(injectVisualEditScriptTag(first ?? "")).toBe(first);
  });

  it("preserves user layout content and declines layouts without a body", () => {
    const inline = "export default function Layout({ children }) { return <html><body>{children}</body></html>; }";
    expect(injectVisualEditScriptTag(inline)).toContain("cognix:visual-edit:start");
    const layout = "export default function Layout() { return <main>App</main>; }";
    expect(injectVisualEditScriptTag(layout)).toBeNull();
  });

  it("pins parent messaging to the configured builder origin and avoids sensitive DOM capture", () => {
    const source = createVisualEditBridgeSource("https://builder.example.com");
    expect(() => new Function(source)).not.toThrow();
    expect(source).toContain('var PARENT_ORIGIN = "https://builder.example.com"');
    expect(source).toContain('event.source !== window.parent || event.origin !== PARENT_ORIGIN');
    expect(source).toContain('event.metaKey || event.ctrlKey');
    expect(source).toContain('"href", "src"');
    expect(source).not.toContain('getAttribute("value")');
    expect(source).not.toContain("outerHTML");
  });
});
