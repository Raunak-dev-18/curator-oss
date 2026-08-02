import { describe, expect, it } from "vitest";
import type { Message } from "./types";
import { checkpointCanRestore, checkpointChangesFor } from "./checkpoints";

function message(fileChanges: unknown, metadata: Record<string, unknown> = {}): Message {
  return {
    id: "message-1",
    projectId: "project-1",
    role: "assistant",
    content: "Done",
    metadata: { fileChanges, ...metadata },
    createdAt: new Date(0).toISOString(),
  };
}

describe("build checkpoints", () => {
  it("accepts complete file snapshots", () => {
    const build = message([{ path: "app/page.tsx", before: "old", after: "new" }]);
    expect(checkpointChangesFor(build)).toEqual([{ path: "app/page.tsx", before: "old", after: "new" }]);
    expect(checkpointCanRestore(build).canRestore).toBe(true);
  });

  it("accepts creation and deletion snapshots", () => {
    expect(checkpointCanRestore(message([
      { path: "app/new.tsx", before: null, after: "new" },
      { path: "app/old.tsx", before: "old", after: null },
    ])).canRestore).toBe(true);
  });

  it("refuses truncated, traversal, and already restored checkpoints", () => {
    expect(checkpointCanRestore(message([
      { path: "app/page.tsx", before: "old", after: "new", truncated: true },
    ])).canRestore).toBe(false);
    expect(checkpointCanRestore(message([
      { path: "../secret", before: "old", after: "new" },
    ])).canRestore).toBe(false);
    expect(checkpointCanRestore(message([
      { path: "/etc/passwd", before: "old", after: "new" },
    ])).canRestore).toBe(false);
    expect(checkpointCanRestore(message([
      { path: "app/empty.tsx", before: null, after: null },
    ])).canRestore).toBe(false);
    expect(checkpointCanRestore(message([
      { path: "app/page.tsx", before: "old", after: "new" },
    ], { restoredAt: new Date().toISOString() })).canRestore).toBe(false);
  });
});
