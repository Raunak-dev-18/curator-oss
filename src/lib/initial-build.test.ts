import { describe, expect, it } from "vitest";
import { hasPersistedPrompt, stripInitialBuildParams } from "./initial-build";

describe("stripInitialBuildParams", () => {
  it("consumes prompt and attachment parameters without removing other URL state", () => {
    expect(
      stripInitialBuildParams(
        "http://localhost:3000/projects/project-1?prompt=Build+a+store&attachments=one%2Ctwo&panel=code#preview",
      ),
    ).toBe("/projects/project-1?panel=code#preview");
  });
});

describe("hasPersistedPrompt", () => {
  it("recognizes a stale bootstrap prompt that was already submitted", () => {
    expect(hasPersistedPrompt([{ role: "user", content: "  Build a store  " }], "Build a store")).toBe(true);
    expect(hasPersistedPrompt([{ role: "assistant", content: "Build a store" }], "Build a store")).toBe(false);
  });
});
