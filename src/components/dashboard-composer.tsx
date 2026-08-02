"use client";

import { ArrowUp, Code2, Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { validateUpload } from "@/lib/upload-policy";
import { cn } from "@/lib/utils";
import { PendingUpload } from "./pending-upload";

const starterPrompts = [
  "A customer support portal with AI summaries",
  "A collaborative project tracker for a small team",
  "An analytics dashboard for subscription revenue",
];

const accept = "image/*,.pdf,.md,.txt,.json";

export function DashboardComposer({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  function addFiles(incoming: File[]) {
    const valid: File[] = [];
    for (const file of incoming) {
      const error = validateUpload(file);
      if (error) toast.error(`${file.name || "Attachment"}: ${error}`);
      else valid.push(file);
    }
    setFiles((current) => {
      const next = [...current];
      for (const file of valid) {
        if (!next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) next.push(file);
      }
      if (next.length > 10) toast.error("You can attach up to 10 files per project.");
      return next.slice(0, 10);
    });
  }

  async function createProject() {
    if (prompt.trim().length < 3 || isCreating) return;
    setIsCreating(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not create the project.");

      const attachmentIds: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const upload = await fetch(`/api/projects/${payload.project.id}/upload`, { method: "POST", body: formData });
        const uploadPayload = await upload.json();
        if (!upload.ok) throw new Error(uploadPayload.error ?? `Could not upload ${file.name}.`);
        attachmentIds.push(uploadPayload.attachment.id);
      }

      const search = new URLSearchParams({ prompt: prompt.trim() });
      if (attachmentIds.length) search.set("attachments", attachmentIds.join(","));
      router.push(`/projects/${payload.project.id}?${search.toString()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
      setIsCreating(false);
    }
  }

  return (
    <div className="w-full max-w-[680px]">
      <form
        className={cn("dashboard-composer", isDragging && "is-dragging")}
        onSubmit={(event) => { event.preventDefault(); void createProject(); }}
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setIsDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}
      >
        {files.length ? (
          <div className="pending-upload-list" aria-label="Attached files">
            {files.map((file, index) => (
              <PendingUpload key={`${file.name}-${file.size}-${file.lastModified}`} file={file} onRemove={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
            ))}
          </div>
        ) : null}
        <textarea
          autoFocus={autoFocus}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onPaste={(event) => {
            const images = Array.from(event.clipboardData.items)
              .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
              .map((item) => item.getAsFile())
              .filter((file): file is File => Boolean(file))
              .map((file, index) => file.name
                ? file
                : new File([file], `pasted-image-${Date.now()}-${index + 1}.png`, { type: file.type || "image/png" }));
            if (images.length) {
              event.preventDefault();
              addFiles(images);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void createProject();
            }
          }}
          rows={3}
          maxLength={12_000}
          placeholder="Describe the app you want Cognix to build…"
          aria-label="Describe the app you want to build"
          aria-describedby="composer-help"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <input ref={fileInputRef} className="sr-only" type="file" multiple accept={accept} onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
            <button type="button" className="composer-tool-button" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="size-4" /> <span>Attach</span>
            </button>
            <span className="hidden items-center gap-1.5 px-2 text-[12px] text-white/45 sm:flex"><Code2 className="size-3.5" /> Full stack</span>
          </div>
          <div className="flex items-center gap-3">
            <span id="composer-help" className="hidden text-[10px] text-white/30 sm:inline">Enter to build · Shift+Enter for a new line</span>
            <button type="submit" className="build-button" disabled={prompt.trim().length < 3 || isCreating} aria-label="Create project and start building">
              {isCreating ? <span className="spinner" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
        </div>
        {isDragging ? <div className="composer-drop-overlay">Drop files to attach</div> : null}
      </form>
      <div className="mt-4 hidden items-center justify-center gap-2 lg:flex" aria-label="Example prompts">
        {starterPrompts.map((item) => <button key={item} className="starter-prompt" type="button" onClick={() => setPrompt(item)}>{item}</button>)}
      </div>
    </div>
  );
}
