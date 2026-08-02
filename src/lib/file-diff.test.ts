import { describe, expect, it } from "vitest";
import { buildDiffRows } from "./file-diff";

describe("buildDiffRows", () => {
  it("tracks additions, removals, and line numbers", () => {
    const rows = buildDiffRows("one\ntwo\n", "one\nthree\n");

    expect(rows).toEqual([
      { kind: "context", content: "one", oldLine: 1, newLine: 1 },
      { kind: "removed", content: "two", oldLine: 2, newLine: null },
      { kind: "added", content: "three", oldLine: null, newLine: 2 },
    ]);
  });

  it("represents a new file entirely as additions", () => {
    expect(buildDiffRows("", "first\nsecond")).toEqual([
      { kind: "added", content: "first", oldLine: null, newLine: 1 },
      { kind: "added", content: "second", oldLine: null, newLine: 2 },
    ]);
  });
});
