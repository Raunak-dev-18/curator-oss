"use client";

import { Braces, ChevronRight, FileCode2, FileJson, Folder, Save, Search, X } from "lucide-react";
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ProjectFile } from "@/lib/types";
import { cn } from "@/lib/utils";

function FileIcon({ path }: { path: string }) {
  if (path.endsWith(".json")) return <FileJson className="size-3.5 text-amber-400/80" />;
  if (path.endsWith(".css")) return <Braces className="size-3.5 text-violet-400/80" />;
  return <FileCode2 className="size-3.5 text-sky-400/80" />;
}

function parentPath(value: string) {
  return value.split("/").slice(0, -1).join("/");
}

function displayName(value: string) {
  return value.split("/").at(-1) ?? value;
}

type TreeGroup = { directories: string[]; files: ProjectFile[] };

function buildTreeIndex(files: ProjectFile[]) {
  const directorySet = new Set<string>();
  for (const file of files) {
    const parts = file.path.split("/");
    parts.pop();
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      directorySet.add(current);
    }
  }

  const index = new Map<string, TreeGroup>();
  const groupFor = (parent: string) => {
    const current = index.get(parent) ?? { directories: [], files: [] };
    index.set(parent, current);
    return current;
  };
  for (const directory of directorySet) groupFor(parentPath(directory)).directories.push(directory);
  for (const file of files) groupFor(parentPath(file.path)).files.push(file);
  for (const group of index.values()) {
    group.directories.sort((a, b) => a.localeCompare(b));
    group.files.sort((a, b) => a.path.localeCompare(b.path));
  }
  return index;
}

type CodeWorkbenchProps = {
  projectId: string;
  files: ProjectFile[];
  selectedPath: string;
  onSelectPath: (path: string) => void;
  onFilesChange: Dispatch<SetStateAction<ProjectFile[]>>;
};

export function CodeWorkbench({ projectId, files, selectedPath, onSelectPath, onFilesChange }: CodeWorkbenchProps) {
  const fallbackFile = files[0] ?? null;
  const selectedFile = files.find((file) => file.path === selectedPath) ?? fallbackFile;
  const activePath = selectedFile?.path ?? "";
  const [query, setQuery] = useState("");
  const [collapsedDirectories, setCollapsedDirectories] = useState<Set<string>>(() => new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const treeIndex = useMemo(() => buildTreeIndex(files), [files]);
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return files.filter((file) =>
      file.path.toLowerCase().includes(normalized) || file.content?.toLowerCase().includes(normalized),
    );
  }, [files, query]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (!selectedFile || selectedFile.content !== null) return;

    let cancelled = false;
    void fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(selectedFile.path)}`)
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (cancelled) return;
        if (!response.ok) throw new Error(payload.error ?? "Could not read this file.");
        onFilesChange((current) => current.map((item) => (item.path === selectedFile.path ? payload.file : item)));
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not read this file.");
      })
    return () => {
      cancelled = true;
    };
  }, [projectId, selectedFile, onFilesChange]);

  function toggleDirectory(directory: string) {
    setCollapsedDirectories((current) => {
      const next = new Set(current);
      if (next.has(directory)) next.delete(directory);
      else next.add(directory);
      return next;
    });
  }

  function renderTree(parent = "", level = 1): ReactNode {
    const group = treeIndex.get(parent);
    if (!group) return null;
    return (
      <>
        {group.directories.map((directory) => {
          const collapsed = collapsedDirectories.has(directory);
          return (
            <div key={`directory-${directory}`} role="none">
              <button
                type="button"
                className="file-tree-row directory"
                style={{ paddingLeft: 8 + (level - 1) * 14 }}
                role="treeitem"
                aria-level={level}
                aria-expanded={!collapsed}
                aria-selected={false}
                onClick={() => toggleDirectory(directory)}
                title={directory}
              >
                <ChevronRight className={cn("size-3 text-white/35 transition-transform", !collapsed && "rotate-90")} />
                <Folder className="size-3.5 text-white/45" />
                <span>{displayName(directory)}</span>
              </button>
              {!collapsed ? <div role="group">{renderTree(directory, level + 1)}</div> : null}
            </div>
          );
        })}
        {group.files.map((file) => (
          <button
            key={file.path}
            type="button"
            className={cn("file-tree-row", activePath === file.path && "is-active")}
            style={{ paddingLeft: 14 + (level - 1) * 14 }}
            onClick={() => onSelectPath(file.path)}
            role="treeitem"
            aria-level={level}
            aria-selected={activePath === file.path}
            title={file.path}
          >
            <FileIcon path={file.path} />
            <span>{displayName(file.path)}</span>
          </button>
        ))}
      </>
    );
  }

  return (
    <div className="code-workbench">
      <aside className="file-explorer" aria-label="Project files">
        <div className="file-search">
          <Search className="size-3.5" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search code"
            aria-label="Search project code"
          />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear code search"><X className="size-3" /></button> : <kbd>Ctrl P</kbd>}
        </div>
        <div className="file-tree" role="tree" aria-label={query ? "Code search results" : "Project file tree"}>
          {query ? (
            searchResults.length ? searchResults.map((file) => (
              <button
                key={file.path}
                type="button"
                className={cn("file-search-result", activePath === file.path && "is-active")}
                onClick={() => onSelectPath(file.path)}
                role="treeitem"
                aria-selected={activePath === file.path}
              >
                <FileIcon path={file.path} />
                <span><strong>{displayName(file.path)}</strong><small>{file.path}</small></span>
              </button>
            )) : <p className="file-search-empty">No files or code match “{query}”.</p>
          ) : renderTree()}
        </div>
      </aside>

      {selectedFile ? (
        <FileEditor
          key={`${selectedFile.path}:${selectedFile.content === null ? "loading" : "ready"}`}
          projectId={projectId}
          file={selectedFile}
          onFilesChange={onFilesChange}
        />
      ) : <section className="code-editor-panel"><div className="grid h-full place-items-center text-sm text-white/35">No project files yet.</div></section>}
    </div>
  );
}

function FileEditor({
  projectId,
  file,
  onFilesChange,
}: {
  projectId: string;
  file: ProjectFile;
  onFilesChange: Dispatch<SetStateAction<ProjectFile[]>>;
}) {
  const [content, setContent] = useState(file.content ?? "");
  const [savedContent, setSavedContent] = useState(file.content ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const lineNumbersRef = useRef<HTMLPreElement>(null);
  const lineCount = Math.max(1, content.split("\n").length);

  async function saveFile() {
    if (content === savedContent || isSaving || file.content === null) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file.path, content }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not save this file.");
      onFilesChange((current) => current.map((item) => (item.path === file.path ? payload.file : item)));
      setSavedContent(content);
      toast.success(`Saved ${file.path}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this file.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="code-editor-panel">
      <div className="code-tabbar">
        <span className="code-tab" title={file.path}><FileIcon path={file.path} /> {file.path}</span>
        <button type="button" className="save-code-button" onClick={() => void saveFile()} disabled={content === savedContent || isSaving || file.content === null}>
          <Save className="size-3.5" /> {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="code-editor-wrap" aria-busy={file.content === null}>
        <pre ref={lineNumbersRef} className="line-numbers" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => `${index + 1}\n`).join("")}
        </pre>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onScroll={(event) => {
            if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop;
          }}
          spellCheck={false}
          aria-label={`Editing ${file.path}`}
        />
        {file.content === null ? <div className="editor-loading"><span className="spinner" /> Reading file…</div> : null}
      </div>
    </section>
  );
}
