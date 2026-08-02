import type { FileChangeSnapshot, Message } from "./types";

const MAX_CHECKPOINT_FILES = 100;

export function checkpointChangesFor(message: Pick<Message, "metadata">): FileChangeSnapshot[] {
  if (!Array.isArray(message.metadata.fileChanges)) return [];
  return message.metadata.fileChanges.slice(0, MAX_CHECKPOINT_FILES).filter((item): item is FileChangeSnapshot => {
    if (!item || typeof item !== "object") return false;
    const change = item as Partial<FileChangeSnapshot>;
    if (
      typeof change.path !== "string"
      || !change.path
      || change.path.length > 500
      || /^[\\/]/.test(change.path)
      || change.path.includes("\0")
      || change.path.replaceAll("\\", "/").split("/").includes("..")
    ) return false;
    const beforeIsValid = change.before === null || typeof change.before === "string";
    const afterIsValid = change.after === null || typeof change.after === "string";
    return beforeIsValid
      && afterIsValid
      && !(change.before === null && change.after === null)
      && change.truncated !== true;
  });
}

export function checkpointCanRestore(message: Pick<Message, "metadata">) {
  const rawChanges = Array.isArray(message.metadata.fileChanges) ? message.metadata.fileChanges : [];
  const changes = checkpointChangesFor(message);
  return {
    canRestore: changes.length > 0 && changes.length === rawChanges.length && typeof message.metadata.restoredAt !== "string",
    changes,
  };
}
