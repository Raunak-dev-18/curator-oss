"use client";

import { FileCode2, FileMinus2, FilePlus2, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { buildDiffRows } from "@/lib/file-diff";
import type { FileChangeSnapshot, ProjectFile } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChangeDetailsProps = {
  changedPaths: string[];
  fileChanges: FileChangeSnapshot[];
  files: ProjectFile[];
  selectedPath: string;
  onSelectPath: (path: string) => void;
  onOpenFile: (path: string) => void;
};

function fileName(path: string) {
  return path.split("/").at(-1) ?? path;
}

export function ChangeDetails({
  changedPaths,
  fileChanges,
  files,
  selectedPath,
  onSelectPath,
  onOpenFile,
}: ChangeDetailsProps) {
  const snapshot = fileChanges.find((change) => change.path === selectedPath) ?? null;
  const currentFile = files.find((file) => file.path === selectedPath) ?? null;
  const before = snapshot?.before ?? "";
  const after = snapshot ? (snapshot.after ?? "") : (currentFile?.content ?? "");
  const rows = useMemo(() => buildDiffRows(before, after), [after, before]);
  const additions = rows.filter((row) => row.kind === "added").length;
  const removals = rows.filter((row) => row.kind === "removed").length;

  return (
    <div className="change-details">
      <aside className="change-file-list" aria-label="Edited files">
        <div className="change-file-list-heading">
          <strong>Changed files</strong>
          <span>{changedPaths.length}</span>
        </div>
        <div className="change-file-list-scroll">
          {changedPaths.map((path) => {
            const isNew = fileChanges.find((change) => change.path === path)?.before === null;
            const isDeleted = fileChanges.find((change) => change.path === path)?.after === null;
            return (
              <button
                key={path}
                type="button"
                className={cn("change-file-row", selectedPath === path && "is-active")}
                onClick={() => onSelectPath(path)}
                title={path}
              >
                {isDeleted
                  ? <FileMinus2 className="size-3.5 text-rose-400" />
                  : isNew
                    ? <FilePlus2 className="size-3.5 text-emerald-400" />
                    : <FileCode2 className="size-3.5 text-sky-400/80" />}
                <span><strong>{fileName(path)}</strong><small>{path}</small></span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="diff-panel" aria-label={`Changes in ${selectedPath}`}>
        <header className="diff-header">
          <div className="min-w-0">
            <strong title={selectedPath}>{selectedPath || "No changed file selected"}</strong>
            {snapshot?.truncated ? <span className="diff-truncated"><TriangleAlert className="size-3" /> Large file diff was shortened</span> : null}
          </div>
          <div className="diff-header-actions">
            {snapshot ? <span className="diff-stats"><b>+{additions}</b><i>-{removals}</i></span> : null}
            {selectedPath && snapshot?.after !== null
              ? <button type="button" onClick={() => onOpenFile(selectedPath)}>Open file</button>
              : null}
          </div>
        </header>

        {!snapshot ? (
          <div className="diff-unavailable">
            <FileCode2 className="size-5" />
            <strong>Original version unavailable</strong>
            <p>This build predates file-change snapshots. The current file is shown below without a comparison.</p>
          </div>
        ) : null}

        <div className="diff-scroll" role="table" aria-label="File diff">
          {rows.length ? rows.map((row, index) => (
            <div key={`${row.kind}-${index}`} className={cn("diff-line", `is-${row.kind}`)} role="row">
              <span className="diff-line-number" role="cell">{row.oldLine ?? ""}</span>
              <span className="diff-line-number" role="cell">{row.newLine ?? ""}</span>
              <span className="diff-sign" aria-hidden="true">{row.kind === "added" ? "+" : row.kind === "removed" ? "-" : " "}</span>
              <code role="cell">{row.content || " "}</code>
            </div>
          )) : <div className="diff-empty">No textual changes to display.</div>}
        </div>
      </section>
    </div>
  );
}
