import { diffLines } from "diff";

export type DiffRow = {
  kind: "added" | "removed" | "context";
  content: string;
  oldLine: number | null;
  newLine: number | null;
};

function linesIn(value: string) {
  const lines = value.split("\n");
  if (value.endsWith("\n")) lines.pop();
  return lines;
}

export function buildDiffRows(before: string, after: string): DiffRow[] {
  let oldLine = 1;
  let newLine = 1;
  const rows: DiffRow[] = [];

  for (const change of diffLines(before, after)) {
    for (const content of linesIn(change.value)) {
      if (change.added) {
        rows.push({ kind: "added", content, oldLine: null, newLine });
        newLine += 1;
      } else if (change.removed) {
        rows.push({ kind: "removed", content, oldLine, newLine: null });
        oldLine += 1;
      } else {
        rows.push({ kind: "context", content, oldLine, newLine });
        oldLine += 1;
        newLine += 1;
      }
    }
  }

  return rows;
}
