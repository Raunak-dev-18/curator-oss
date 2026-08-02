import { describe, expect, it } from "vitest";
import type { VisualElementSelection } from "./types";
import {
  applyVisualSelection,
  MAX_VISUAL_SELECTIONS,
  parseVisualSelections,
  visualElementSelectionSchema,
  visualSelectionsSchema,
} from "./visual-edit";

function selection(id = "home::#save"): VisualElementSelection {
  return {
    id,
    route: "/settings",
    selector: "main > form > button:nth-of-type(1)",
    tagName: "button",
    role: "button",
    accessibleName: "Save changes",
    text: "Save changes",
    attributes: { class: "primary", "aria-label": "Save changes" },
    rect: { x: 10, y: 20, width: 140, height: 40 },
    viewport: { width: 1280, height: 800 },
    styles: { display: "inline-flex", backgroundColor: "rgb(0, 0, 0)" },
    componentStack: [{ name: "SaveButton", source: { file: "app/settings/page.tsx", line: 24, column: 7 } }],
  };
}

describe("visual element selection contract", () => {
  it("accepts bounded element and React source hints", () => {
    expect(visualElementSelectionSchema.parse(selection())).toMatchObject({
      route: "/settings",
      componentStack: [{ name: "SaveButton" }],
    });
  });

  it("rejects query strings, sensitive extra fields, and excessive selections", () => {
    expect(visualElementSelectionSchema.safeParse({ ...selection(), route: "/settings?token=secret" }).success).toBe(false);
    expect(visualElementSelectionSchema.safeParse({ ...selection(), outerHTML: "<button>unsafe</button>" }).success).toBe(false);
    expect(visualSelectionsSchema.safeParse(
      Array.from({ length: MAX_VISUAL_SELECTIONS + 1 }, (_, index) => selection(String(index))),
    ).success).toBe(false);
  });

  it("replaces normally, appends with Ctrl/Cmd, deduplicates, and caps at five", () => {
    expect(applyVisualSelection([selection("old")], selection("new"), false).map((item) => item.id)).toEqual(["new"]);
    const appended = Array.from({ length: 5 }, (_, index) => selection(String(index)))
      .reduce((current, item) => applyVisualSelection(current, item, true), [] as VisualElementSelection[]);
    const capped = applyVisualSelection(appended, selection("5"), true);
    expect(capped.map((item) => item.id)).toEqual(["1", "2", "3", "4", "5"]);
    expect(applyVisualSelection(capped, selection("3"), true).map((item) => item.id)).toEqual(["1", "2", "4", "5", "3"]);
  });

  it("returns no persisted references when metadata is malformed", () => {
    expect(parseVisualSelections([{ selector: "button" }])).toEqual([]);
  });
});
