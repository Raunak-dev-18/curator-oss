"use client";

import {
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FolderTree,
  Globe2,
  History,
  Home,
  ImagePlus,
  LoaderCircle,
  MessageSquare,
  Monitor,
  MousePointer2,
  Paperclip,
  Play,
  RefreshCw,
  RotateCcw,
  Rocket,
  Search,
  Share2,
  Sparkles,
  Smartphone,
  Tablet,
  TerminalSquare,
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import { toast } from "sonner";
import { hasPersistedPrompt, stripInitialBuildParams } from "@/lib/initial-build";
import type {
  AgentEvent,
  AgentRunActivity,
  Attachment,
  FileChangeSnapshot,
  Message,
  Project,
  ProjectFile,
  Viewer,
  VisualElementSelection,
} from "@/lib/types";
import { checkpointCanRestore } from "@/lib/checkpoints";
import { validateUpload } from "@/lib/upload-policy";
import { cn, formatRelativeDate, publishSlugFromTitle } from "@/lib/utils";
import {
  applyVisualSelection,
  parseVisualSelections,
  VISUAL_EDIT_SOURCE,
  VISUAL_EDIT_VERSION,
  visualElementSelectionSchema,
  visualSelectionLabel,
} from "@/lib/visual-edit";
import { BrandMark } from "./brand-mark";
import { ChangeDetails } from "./change-details";
import { CodeWorkbench } from "./code-workbench";
import { AssistantMessageContent, UserMessageContent } from "./message-content";
import { PendingUpload } from "./pending-upload";
import { PreviewPlaceholder } from "./preview-placeholder";
import { UserAvatar } from "./user-avatar";

type Activity = {
  id: string;
  name: string;
  label: string;
  status: "running" | "done";
};

type PreviewDevice = "phone" | "tablet" | "desktop";

type WorkspaceClientProps = {
  initialProject: Project;
  initialMessages: Message[];
  initialFiles: ProjectFile[];
  viewer: Viewer;
  initialNow: string;
  initialPrompt?: string;
  initialAttachmentIds?: string[];
};

const suggestions = ["Add a dashboard", "Create a settings page", "Improve mobile layout"];
const acceptedUploads = "image/*,.pdf,.md,.txt,.json";

type MessageImage = { key: string; name: string; url: string };
type ComposerUpload = {
  localId: string;
  file: File;
  status: "uploading" | "uploaded" | "error";
  attachment?: Attachment;
};

function subscribeToSiteOrigin() {
  return () => undefined;
}

function imageAttachmentsFor(message: Message): MessageImage[] {
  if (!Array.isArray(message.metadata.attachments)) return [];
  return message.metadata.attachments.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const value = item as { id?: unknown; name?: unknown; contentType?: unknown };
    if (typeof value.contentType !== "string" || !value.contentType.startsWith("image/")) return [];
    if (typeof value.id !== "string") return [];
    const name = typeof value.name === "string" ? value.name : `Attached image ${index + 1}`;
    return [{ key: value.id, name, url: `/api/uploads/${value.id}` }];
  });
}

function MessageImages({ images }: { images: MessageImage[] }) {
  if (!images.length) return null;
  return (
    <div className="message-image-grid" aria-label="Attached images">
      {images.map((image) => (
        <a key={image.key} href={image.url} target="_blank" rel="noreferrer" title={`Open ${image.name}`}>
          <Image src={image.url} alt={image.name} width={148} height={104} unoptimized />
        </a>
      ))}
    </div>
  );
}

function VisualSelectionReferences({
  selections,
  onRemove,
}: {
  selections: VisualElementSelection[];
  onRemove?: (id: string) => void;
}) {
  if (!selections.length) return null;
  return (
    <div className={cn("visual-reference-list", onRemove ? "is-composer" : "is-message")} aria-label="Selected preview elements">
      {selections.map((selection) => (
        <span className="visual-reference-chip" key={selection.id} title={`${selection.route} · ${selection.selector}`}>
          <MousePointer2 className="size-3" aria-hidden="true" />
          <span>
            <strong>{visualSelectionLabel(selection)}</strong>
            <small>{selection.route}</small>
          </span>
          {onRemove ? (
            <button type="button" onClick={() => onRemove(selection.id)} aria-label={`Remove ${visualSelectionLabel(selection)} reference`}>
              <X className="size-3" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function visualSelectionsFor(message: Message) {
  return parseVisualSelections(message.metadata.visualSelections);
}

function changedPathsFor(message: Message) {
  return Array.isArray(message.metadata.changedPaths)
    ? message.metadata.changedPaths.filter((item): item is string => typeof item === "string")
    : [];
}

function fileChangesFor(message: Message): FileChangeSnapshot[] {
  if (!Array.isArray(message.metadata.fileChanges)) return [];
  return message.metadata.fileChanges.filter((item): item is FileChangeSnapshot => {
    if (!item || typeof item !== "object") return false;
    const value = item as Partial<FileChangeSnapshot>;
    return typeof value.path === "string" && (value.after === null || typeof value.after === "string")
      && (value.before === null || typeof value.before === "string");
  });
}

function attachmentIdsFor(message: Message) {
  return Array.isArray(message.metadata.attachmentIds)
    ? message.metadata.attachmentIds.filter((item): item is string => typeof item === "string")
    : [];
}

function runActivityFor(message: Message): AgentRunActivity[] {
  if (!Array.isArray(message.metadata.activity)) return [];
  return message.metadata.activity.filter((item): item is AgentRunActivity => {
    if (!item || typeof item !== "object") return false;
    const value = item as Partial<AgentRunActivity>;
    return typeof value.id === "string"
      && typeof value.name === "string"
      && typeof value.label === "string"
      && (value.status === "done" || value.status === "error")
      && typeof value.durationMs === "number";
  });
}

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) return `${Math.max(0, Math.round(durationMs))} ms`;
  if (durationMs < 60_000) return `${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
  return `${Math.floor(durationMs / 60_000)}m ${Math.round((durationMs % 60_000) / 1_000)}s`;
}

function ActivityIcon({ name, running }: { name: string; running: boolean }) {
  if (running) return <LoaderCircle className="size-3.5 animate-spin" />;
  if (name === "read_attachment") return <ImagePlus className="size-3.5" />;
  if (name === "run_command") return <TerminalSquare className="size-3.5" />;
  if (name === "list_files" || name === "find_files") return <FolderTree className="size-3.5" />;
  if (name === "search_files") return <Search className="size-3.5" />;
  if (name === "web_search" || name === "fetch_url") return <Globe2 className="size-3.5" />;
  if (name === "get_preview_url" || name === "inspect_preview") return <Play className="size-3.5" />;
  return <FileCode2 className="size-3.5" />;
}

function RunDetails({ message }: { message: Message }) {
  const activity = runActivityFor(message);
  if (!activity.length) return null;
  const duration = typeof message.metadata.runDurationMs === "number"
    ? message.metadata.runDurationMs
    : activity.reduce((total, item) => total + item.durationMs, 0);
  return (
    <details className="run-details">
      <summary>
        <span><TerminalSquare className="size-3.5" /> Run details</span>
        <small>{activity.length} {activity.length === 1 ? "step" : "steps"} · {formatDuration(duration)}</small>
      </summary>
      <div className="run-details-list">
        {activity.map((item) => (
          <div className={cn("run-details-row", item.status === "error" && "is-error")} key={item.id}>
            <span className="activity-icon is-done"><ActivityIcon name={item.name} running={false} /></span>
            <span title={item.label}>{item.label}</span>
            <small>{formatDuration(item.durationMs)}</small>
          </div>
        ))}
      </div>
    </details>
  );
}

function PreviewDeviceIcon({ device }: { device: PreviewDevice }) {
  if (device === "phone") return <Smartphone className="size-3.5" />;
  if (device === "tablet") return <Tablet className="size-3.5" />;
  return <Monitor className="size-3.5" />;
}

type PublishDialogProps = {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  project: Project;
  slug: string;
  publishedUrl: string;
  publishBaseLabel: string;
  canPublish: boolean;
  publishing: boolean;
  onSlugChange: (slug: string) => void;
  onClose: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
};

function PublishDialog({
  open,
  anchorRef,
  project,
  slug,
  publishedUrl,
  publishBaseLabel,
  canPublish,
  publishing,
  onSlugChange,
  onClose,
  onPublish,
  onUnpublish,
}: PublishDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;

    const placeBelowPublishButton = () => {
      const anchor = anchorRef.current;
      if (!anchor || !dialog.open) return;
      const anchorRect = anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const gutter = 10;
      const gap = 8;
      const dialogWidth = dialog.offsetWidth;
      const left = Math.min(
        Math.max(gutter, anchorRect.right - dialogWidth),
        Math.max(gutter, viewportWidth - dialogWidth - gutter),
      );
      const top = anchorRect.bottom + gap;
      dialog.style.left = `${left}px`;
      dialog.style.top = `${top}px`;
      dialog.style.maxHeight = `${Math.max(180, viewportHeight - top - gutter)}px`;
    };

    placeBelowPublishButton();
    window.addEventListener("resize", placeBelowPublishButton);
    window.visualViewport?.addEventListener("resize", placeBelowPublishButton);
    return () => {
      window.removeEventListener("resize", placeBelowPublishButton);
      window.visualViewport?.removeEventListener("resize", placeBelowPublishButton);
    };
  }, [anchorRef, open]);

  return (
    <dialog
      ref={dialogRef}
      className="publish-dialog"
      onCancel={(event) => {
        if (publishing) event.preventDefault();
        else onClose();
      }}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onPublish();
        }}
      >
        <header>
          <div>
            <span className="publish-dialog-icon"><Rocket className="size-4" /></span>
            <div><strong>{project.publishedAt ? "Manage publication" : "Publish this app"}</strong><p>Create a stable public address for the latest production build.</p></div>
          </div>
          <button type="button" aria-label="Close publishing dialog" onClick={onClose} disabled={publishing}><X className="size-4" /></button>
        </header>

        <label className="publish-slug-field">
          <span>Public address</span>
          <div>
            <small title={publishBaseLabel}>{publishBaseLabel}</small>
            <input
              autoFocus
              value={slug}
              onChange={(event) => onSlugChange(
                event.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "")
                  .replace(/-+/g, "-")
                  .replace(/^-+/g, ""),
              )}
              minLength={3}
              maxLength={48}
              pattern={"[a-z0-9][a-z0-9\\-]*[a-z0-9]"}
              placeholder="my-app"
              disabled={publishing}
              required
            />
          </div>
          <small>3–48 lowercase letters, numbers, or hyphens.</small>
        </label>

        <div className="publish-runtime-note">
          <History className="size-4" />
          <div>
            <strong>Runs continuously</strong>
            <p>Publishing creates an isolated production build and disables Daytona auto-stop. This can consume sandbox runtime until you unpublish.</p>
          </div>
        </div>

        {publishedUrl && project.publishedAt ? (
          <div className="published-url-row">
            <span title={publishedUrl}>{publishedUrl}</span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(publishedUrl);
                toast.success("Published URL copied.");
              }}
            >
              <Copy className="size-3.5" /> Copy
            </button>
            <a href={publishedUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /> Open</a>
          </div>
        ) : null}

        <footer>
          {project.publishedAt ? (
            <button type="button" className="unpublish-button" onClick={onUnpublish} disabled={publishing}>Unpublish</button>
          ) : <span />}
          <div>
            <button type="button" onClick={onClose} disabled={publishing}>Cancel</button>
            <button type="submit" className="publish-confirm-button" disabled={publishing || !canPublish}>
              {publishing ? <LoaderCircle className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
              {publishing ? "Building production…" : project.publishedAt ? "Update publication" : "Publish"}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}

function assistantContent(message: Message) {
  if (message.metadata.error !== true) return message.content;
  if (/controller is already closed/i.test(message.content)) {
    return "## Build interrupted\n\nThe browser refreshed while Cognix was responding. Your saved files were not removed; send the next instruction to continue.";
  }
  if (/reached its tool limit|execution budget/i.test(message.content)) {
    return "## Build checkpoint saved\n\nCognix saved the files completed so far. Continue the build to inspect the existing app, finish the remaining work, and repair the preview without starting over.";
  }
  if (/development server did not start|missingDependency|trying to use TypeScript/i.test(message.content)) {
    return "## Preview needs repair\n\nThe generated development server could not start, but the project files were saved. Ask Cognix to **repair the preview** and it will inspect the current app and continue from those files.";
  }
  if (message.content.length > 1_200) {
    return "## Build paused\n\nThe generated app returned a long server error. Your files were saved; ask Cognix to inspect the preview logs and repair the existing app.";
  }
  return message.content;
}

export function WorkspaceClient({
  initialProject,
  initialMessages,
  initialFiles,
  viewer,
  initialNow,
  initialPrompt,
  initialAttachmentIds = [],
}: WorkspaceClientProps) {
  const [project, setProject] = useState(initialProject);
  const [messages, setMessages] = useState(initialMessages);
  const [files, setFiles] = useState(initialFiles);
  const [mode, setMode] = useState<"preview" | "code" | "details">("preview");
  const [selectedCodePath, setSelectedCodePath] = useState(initialFiles[0]?.path ?? "");
  const [detailsMessage, setDetailsMessage] = useState<Message | null>(null);
  const [detailsPath, setDetailsPath] = useState("");
  const [detailsReturnMode, setDetailsReturnMode] = useState<"preview" | "code">("preview");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [previewRevision, setPreviewRevision] = useState(0);
  const [isPreviewReconnecting, setIsPreviewReconnecting] = useState(Boolean(initialProject.sandboxId));
  const [visualEditEnabled, setVisualEditEnabled] = useState(false);
  const [visualEditConnecting, setVisualEditConnecting] = useState(false);
  const [visualBridgeReady, setVisualBridgeReady] = useState(false);
  const [visualSelections, setVisualSelections] = useState<VisualElementSelection[]>([]);
  const [prompt, setPrompt] = useState("");
  const [uploads, setUploads] = useState<ComposerUpload[]>([]);
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [restoringMessageId, setRestoringMessageId] = useState<string | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishSlug, setPublishSlug] = useState(
    initialProject.publishSlug ?? publishSlugFromTitle(initialProject.title),
  );
  const [publishedUrl, setPublishedUrl] = useState(
    initialProject.publishSlug ? `/publish/${initialProject.publishSlug}` : "",
  );
  const siteOrigin = useSyncExternalStore(
    subscribeToSiteOrigin,
    () => window.location.origin,
    () => "",
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isCompact, setIsCompact] = useState(false);
  const [relativeNow, setRelativeNow] = useState(() => new Date(initialNow).getTime());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const publishButtonRef = useRef<HTMLButtonElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const startedInitialPrompt = useRef(false);

  function addUploads(incoming: File[]) {
    const valid: File[] = [];
    for (const file of incoming) {
      const error = validateUpload(file);
      if (error) toast.error(`${file.name || "Attachment"}: ${error}`);
      else valid.push(file);
    }
    const availableSlots = Math.max(0, 10 - uploads.length);
    const accepted = valid.slice(0, availableSlots).map((file) => ({
      localId: crypto.randomUUID(),
      file,
      status: "uploading" as const,
    }));
    if (valid.length > availableSlots) toast.error("You can attach up to 10 files per message.");
    if (!accepted.length) return;
    setUploads((current) => [...current, ...accepted].slice(0, 10));
    for (const item of accepted) void uploadComposerAttachment(item.localId, item.file);
  }

  async function uploadComposerAttachment(localId: string, file: File) {
    setUploads((current) => current.map((item) => item.localId === localId ? { ...item, status: "uploading", attachment: undefined } : item));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/projects/${project.id}/upload`, { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? `Could not upload ${file.name}.`);
      setUploads((current) => current.map((item) => item.localId === localId
        ? { ...item, status: "uploaded", attachment: payload.attachment as Attachment }
        : item));
    } catch (error) {
      const message = error instanceof Error ? error.message : `Could not upload ${file.name}.`;
      setUploads((current) => current.map((item) => item.localId === localId ? { ...item, status: "error", attachment: undefined } : item));
      toast.error(message);
    }
  }

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setRelativeNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: isBuilding ? "smooth" : "auto" });
  }, [messages, activities, isBuilding]);

  useEffect(() => {
    if (!initialProject.sandboxId) return;
    let cancelled = false;

    const wait = (delayMs: number) => new Promise((resolve) => window.setTimeout(resolve, delayMs));
    async function reconnectPreview() {
      setIsPreviewReconnecting(true);
      for (let attempt = 0; attempt < 36 && !cancelled; attempt += 1) {
        try {
          const response = await fetch(`/api/projects/${initialProject.id}/preview`, { cache: "no-store" });
          const payload = await response.json();
          if (response.ok && typeof payload.url === "string") {
            if (cancelled) return;
            setVisualBridgeReady(false);
            setProject(payload.project
              ? { ...(payload.project as Project), previewUrl: payload.url }
              : (current) => ({ ...current, previewUrl: payload.url }));
            setPreviewRevision((current) => current + 1);
            setIsPreviewReconnecting(false);
            return;
          }
        } catch {
          // Keep retrying while Daytona wakes the sandbox and starts the dev server.
        }
        await wait(attempt < 6 ? 2_500 : 5_000);
      }
      if (!cancelled) setIsPreviewReconnecting(false);
    }

    void reconnectPreview();
    return () => {
      cancelled = true;
    };
  }, [initialProject.id, initialProject.sandboxId]);

  const currentPreviewUrl = project.previewUrl;
  const canPublish = Boolean(project.sandboxId || currentPreviewUrl);
  const resolvedPublishedUrl = publishedUrl && siteOrigin
    ? new URL(publishedUrl, siteOrigin).toString()
    : publishedUrl;
  const publishBaseLabel = siteOrigin
    ? `${new URL(siteOrigin).host}/publish/`
    : "/publish/";
  const projectHost = useMemo(() => {
    if (!currentPreviewUrl) return "Preview will appear here";
    try { return new URL(currentPreviewUrl).host; } catch { return currentPreviewUrl; }
  }, [currentPreviewUrl]);
  const visibleActivities = useMemo(() => [
    ...activities.filter((activity) => activity.name === "read_attachment").slice(-2),
    ...activities.filter((activity) => activity.name !== "read_attachment").slice(-5),
  ], [activities]);
  const previewOrigin = useMemo(() => {
    if (!currentPreviewUrl) return null;
    try { return new URL(currentPreviewUrl).origin; } catch { return null; }
  }, [currentPreviewUrl]);
  const visualChannel = `${project.id}:visual-edit-v1`;

  const postVisualState = useCallback((enabled: boolean, selections: VisualElementSelection[]) => {
    const frameWindow = previewFrameRef.current?.contentWindow;
    if (!frameWindow || !previewOrigin) return;
    frameWindow.postMessage(
      {
        source: VISUAL_EDIT_SOURCE,
        version: VISUAL_EDIT_VERSION,
        channelId: visualChannel,
        type: "configure",
        enabled,
        selections: selections.map((selection) => ({ id: selection.id, selector: selection.selector })),
      },
      previewOrigin,
    );
  }, [previewOrigin, visualChannel]);

  useEffect(() => {
    function handleVisualMessage(event: MessageEvent) {
      if (!previewOrigin || event.origin !== previewOrigin || event.source !== previewFrameRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      const message = data as Record<string, unknown>;
      if (message.source !== VISUAL_EDIT_SOURCE || message.version !== VISUAL_EDIT_VERSION) return;

      if (message.type === "ready") {
        setVisualBridgeReady(true);
        postVisualState(visualEditEnabled, visualSelections);
        return;
      }
      if (message.channelId !== visualChannel) return;

      if (message.type === "element_selected") {
        const parsed = visualElementSelectionSchema.safeParse(message.selection);
        if (!parsed.success) return;
        setVisualSelections((current) => applyVisualSelection(current, parsed.data, message.append === true));
        return;
      }
      if (message.type === "closed") {
        setVisualEditEnabled(false);
        return;
      }
      if (message.type === "route_changed") {
        setVisualSelections([]);
      }
    }

    window.addEventListener("message", handleVisualMessage);
    return () => window.removeEventListener("message", handleVisualMessage);
  }, [postVisualState, previewOrigin, visualChannel, visualEditEnabled, visualSelections]);

  useEffect(() => {
    if (visualBridgeReady) postVisualState(visualEditEnabled, visualSelections);
  }, [postVisualState, visualBridgeReady, visualEditEnabled, visualSelections]);

  const toggleVisualEdit = useCallback(async () => {
    if (visualEditEnabled) {
      postVisualState(false, visualSelections);
      setVisualEditEnabled(false);
      return;
    }
    if (!currentPreviewUrl || visualEditConnecting) return;

    setVisualEditConnecting(true);
    setMode("preview");
    try {
      const response = await fetch(`/api/projects/${project.id}/visual-edit`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || typeof payload.url !== "string") {
        throw new Error(payload.error ?? "Visual selection could not connect to this preview.");
      }
      setVisualBridgeReady(false);
      setProject((current) => ({ ...current, previewUrl: payload.url }));
      setPreviewRevision((current) => current + 1);
      setVisualEditEnabled(true);
      toast.message("Select an element in the preview. Hold Ctrl or Cmd to select more.");
    } catch (error) {
      setVisualEditEnabled(false);
      toast.error(error instanceof Error ? error.message : "Visual selection could not connect to this preview.");
    } finally {
      setVisualEditConnecting(false);
    }
  }, [currentPreviewUrl, postVisualState, project.id, visualEditConnecting, visualEditEnabled, visualSelections]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "s" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.matches("input, textarea, select, [contenteditable='true']")) return;
      if (mode !== "preview" || !currentPreviewUrl) return;
      event.preventDefault();
      void toggleVisualEdit();
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [currentPreviewUrl, mode, toggleVisualEdit]);

  useEffect(() => {
    if (!visualEditEnabled || visualEditConnecting || visualBridgeReady) return;
    const timeout = window.setTimeout(() => {
      postVisualState(false, visualSelections);
      setVisualEditEnabled(false);
      toast.error("The preview selector did not connect. Refresh the preview and try again.");
    }, 12_000);
    return () => window.clearTimeout(timeout);
  }, [postVisualState, visualBridgeReady, visualEditConnecting, visualEditEnabled, visualSelections]);

  const submitPrompt = useCallback(
    async (
      value: string,
      preuploadedIds: string[] = [],
      referencedSelections: VisualElementSelection[] = visualSelections,
    ) => {
      const cleanPrompt = value.trim();
      if (!cleanPrompt || isBuilding) return;
      if (uploads.some((item) => item.status === "uploading")) {
        toast.message("Wait for the image upload to finish before sending.");
        return;
      }
      if (uploads.some((item) => item.status === "error" || !item.attachment)) {
        toast.error("Remove or retry failed attachments before sending.");
        return;
      }
      const uploadedAttachments = uploads.flatMap((item) => item.attachment ? [item.attachment] : []);
      const attachmentIds = [...preuploadedIds, ...uploadedAttachments.map((item) => item.id)];
      const selectedElements = referencedSelections;
      setIsBuilding(true);
      setProject((current) => ({ ...current, status: "building" }));
      setPrompt("");
      setActivities([{ id: "status", name: "status", label: "Preparing your build", status: "running" }]);

      const userMessage: Message = {
        id: `local-user-${Date.now()}`,
        projectId: project.id,
        role: "user",
        content: cleanPrompt,
        metadata: {
          attachmentIds,
          attachments: uploadedAttachments.map((item) => ({
            id: item.id,
            name: item.name,
            contentType: item.contentType,
            size: item.size,
          })),
          visualSelections: selectedElements,
        },
        createdAt: new Date().toISOString(),
      };
      const assistantId = `local-assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantId,
        projectId: project.id,
        role: "assistant",
        content: "",
        metadata: { streaming: true },
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => [...current, userMessage, assistantMessage]);

      try {
        setUploads([]);

        const response = await fetch(`/api/projects/${project.id}/agent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: cleanPrompt, attachmentIds, visualSelections: selectedElements }),
        });
        if (!response.ok || !response.body) {
          const payload = await response.json();
          throw new Error(payload.error ?? "The build could not start.");
        }
        postVisualState(false, []);
        setVisualEditEnabled(false);
        setVisualSelections([]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleEvent = (event: AgentEvent) => {
          if (event.type === "heartbeat") return;
          if (event.type === "token") {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, content: message.content + event.value } : message,
              ),
            );
          }
          if (event.type === "status") {
            setActivities((current) => [
              ...current.map((item) => ({ ...item, status: "done" as const })),
              { id: `status-${Date.now()}`, name: "status", label: event.label, status: "running" },
            ]);
          }
          if (event.type === "tool_start") {
            setActivities((current) => [
              ...current.map((item) => ({ ...item, status: "done" as const })),
              { id: event.id, name: event.name, label: event.name.replaceAll("_", " "), status: "running" },
            ]);
          }
          if (event.type === "tool_result") {
            setActivities((current) =>
              current.map((item) => item.id === event.id ? { ...item, label: event.summary, status: "done" } : item),
            );
          }
          if (event.type === "attachment_start") {
            setActivities((current) => [
              ...current.map((item) => ({ ...item, status: "done" as const })),
              { id: `attachment-${event.id}`, name: "read_attachment", label: `Reading ${event.path}`, status: "running" },
            ]);
          }
          if (event.type === "attachment_ready") {
            setActivities((current) => current.map((item) => item.id === `attachment-${event.id}`
              ? { ...item, label: `Read ${event.path} · Ready at ${event.appUrl}`, status: "done" }
              : item));
          }
          if (event.type === "preview") {
            setVisualBridgeReady(false);
            setProject((current) => ({
              ...current,
              previewUrl: event.url,
              sandboxId: event.sandboxId ?? current.sandboxId,
              status: "ready",
            }));
            setMode("preview");
          }
          if (event.type === "files_changed") {
            setMessages((current) =>
              current.map((message) => {
                if (message.id !== assistantId) return message;
                const existing = Array.isArray(message.metadata.changedPaths)
                  ? message.metadata.changedPaths.filter((item): item is string => typeof item === "string")
                  : [];
                return {
                  ...message,
                  metadata: { ...message.metadata, changedPaths: [...new Set([...existing, ...event.paths])] },
                };
              }),
            );
            void fetch(`/api/projects/${project.id}/files`)
              .then((result) => result.json())
              .then((payload) => payload.files && setFiles(payload.files));
          }
          if (event.type === "done") {
            setProject((current) => ({ ...current, status: current.status === "published" ? "published" : "ready" }));
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      id: event.messageId,
                      metadata: {
                        ...message.metadata,
                        streaming: false,
                        ...(event.changedPaths ? { changedPaths: event.changedPaths } : {}),
                        ...(event.fileChanges ? { fileChanges: event.fileChanges } : {}),
                        ...(event.activity ? { activity: event.activity } : {}),
                        ...(typeof event.runDurationMs === "number" ? { runDurationMs: event.runDurationMs } : {}),
                      },
                    }
                  : message,
              ),
            );
          }
          if (event.type === "error") throw new Error(event.message);
        };

        while (true) {
          const { value: chunk, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(chunk, { stream: true });
          let newline = buffer.indexOf("\n");
          while (newline >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (line) handleEvent(JSON.parse(line) as AgentEvent);
            newline = buffer.indexOf("\n");
          }
        }

        setActivities((current) => current.map((item) => ({ ...item, status: "done" })));
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : "";
        const message = /failed to fetch|network|load failed|quic|aborted/i.test(rawMessage)
          ? "The live build connection dropped while Cognix was working. Your sandbox may still be saving changes; wait a moment, refresh the project, then continue the build."
          : rawMessage || "The build paused. Try again.";
        setProject((current) => ({ ...current, status: "error" }));
        toast.error(message);
        setMessages((current) =>
          current.map((item) => item.id === assistantId ? { ...item, content: item.content || message, metadata: { error: true } } : item),
        );
      } finally {
        setIsBuilding(false);
      }
    },
    [isBuilding, postVisualState, project.id, uploads, visualSelections],
  );

  async function restoreCheckpoint(message: Message) {
    const checkpoint = checkpointCanRestore(message);
    if (!checkpoint.canRestore || restoringMessageId || isBuilding) return;
    const confirmed = window.confirm(
      `Restore the project to before this build? ${checkpoint.changes.length} ${checkpoint.changes.length === 1 ? "file" : "files"} will be reverted.`,
    );
    if (!confirmed) return;

    setRestoringMessageId(message.id);
    try {
      const response = await fetch(`/api/projects/${project.id}/checkpoints/${message.id}/restore`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "This checkpoint could not be restored.");
      setMessages((current) => [
        ...current.map((item) => item.id === message.id
          ? { ...item, metadata: { ...item.metadata, restoredAt: payload.restoredAt } }
          : item),
        payload.message as Message,
      ]);
      if (Array.isArray(payload.files)) setFiles(payload.files as ProjectFile[]);
      if (payload.project) setProject(payload.project as Project);
      if (typeof payload.previewUrl === "string") {
        setProject((current) => ({ ...current, previewUrl: payload.previewUrl, status: "ready" }));
        setPreviewRevision((current) => current + 1);
      }
      setDetailsMessage(null);
      setMode("preview");
      toast.success("Checkpoint restored. The preview is updating.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This checkpoint could not be restored.");
    } finally {
      setRestoringMessageId(null);
    }
  }

  useEffect(() => {
    if (!initialPrompt) return;
    const cleanLocation = stripInitialBuildParams(window.location.href);
    window.history.replaceState(window.history.state, "", cleanLocation);
    if (startedInitialPrompt.current) return;
    if (hasPersistedPrompt(initialMessages, initialPrompt)) {
      startedInitialPrompt.current = true;
      return;
    }
    window.queueMicrotask(() => {
      if (startedInitialPrompt.current) return;
      startedInitialPrompt.current = true;
      void submitPrompt(initialPrompt, initialAttachmentIds);
    });
  }, [initialPrompt, initialAttachmentIds, initialMessages, submitPrompt]);

  async function refreshPreview() {
    setIsPreviewReconnecting(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/preview`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Preview is not ready yet.");
      setVisualBridgeReady(false);
      setProject(payload.project
        ? { ...(payload.project as Project), previewUrl: payload.url }
        : (current) => ({ ...current, previewUrl: payload.url }));
      setPreviewRevision((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preview is not ready yet.");
    } finally {
      setIsPreviewReconnecting(false);
    }
  }

  async function publishProject() {
    if (isPublishing) return;
    setIsPublishing(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: publishSlug }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Run the app successfully before publishing it.");
      setProject(payload.project);
      setPublishedUrl(payload.url);
      if (response.status === 202 || payload.publishing === true) {
        toast.message("Publishing started. Waiting for the production build…");
        await pollPublication(publishSlug, payload.url);
        toast.success(project.publishedAt ? "Publication updated." : "App published.");
        return;
      }
      toast.success(project.publishedAt ? "Publication updated." : "App published.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish this project.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function pollPublication(targetSlug: string, targetUrl: string) {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 5_000));
      const response = await fetch(`/api/projects/${project.id}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not check publishing status.");
      const nextProject = payload.project as Project;
      setProject(nextProject);
      if (Array.isArray(payload.messages)) setMessages(payload.messages as Message[]);
      if (nextProject.status === "published" && nextProject.publishedAt && nextProject.publishSlug === targetSlug) {
        setPublishedUrl(targetUrl);
        return;
      }
      if (nextProject.status === "error") {
        throw new Error("Production deployment failed. Check the latest assistant message, fix the issue, and publish again.");
      }
    }
    throw new Error("Publishing is still running. Refresh this project in a moment to check the result.");
  }

  async function unpublishProject() {
    if (isPublishing || !project.publishedAt) return;
    if (!window.confirm("Unpublish this app? Its public URL will stop working and Daytona auto-stop will be restored.")) return;
    setIsPublishing(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/publish`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not unpublish this app.");
      setProject(payload.project);
      setPublishDialogOpen(false);
      toast.success("App unpublished. Sandbox auto-stop is enabled again.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not unpublish this app.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function shareProject() {
    try {
      const response = await fetch(`/api/projects/${project.id}/preview`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || typeof payload.url !== "string") {
        throw new Error(payload.error ?? "Build the app before sharing its preview.");
      }
      setProject(payload.project
        ? { ...(payload.project as Project), previewUrl: payload.url }
        : (current) => ({ ...current, previewUrl: payload.url }));
      await navigator.clipboard.writeText(payload.url);
      toast.success("Fresh preview link copied.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Build the app before sharing its preview.");
    }
  }

  function openFile(path: string) {
    setSelectedCodePath(path);
    setMode("code");
  }

  function openDetails(message: Message) {
    const paths = changedPathsFor(message);
    if (!paths.length) return;
    setDetailsMessage(message);
    setDetailsPath(paths[0]);
    setDetailsReturnMode(mode === "code" ? "code" : "preview");
    setMode("details");
  }

  return (
    <div className="workspace-frame">
      <PublishDialog
        open={publishDialogOpen}
        anchorRef={publishButtonRef}
        project={project}
        slug={publishSlug}
        publishedUrl={resolvedPublishedUrl}
        publishBaseLabel={publishBaseLabel}
        canPublish={canPublish}
        publishing={isPublishing}
        onSlugChange={setPublishSlug}
        onClose={() => {
          if (!isPublishing) setPublishDialogOpen(false);
        }}
        onPublish={() => void publishProject()}
        onUnpublish={() => void unpublishProject()}
      />
      <aside className="workspace-rail" aria-label="Workspace navigation">
        <Link href="/" className="grid size-9 place-items-center rounded-lg" aria-label="Cognix dashboard"><BrandMark className="size-5" /></Link>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/" className="workspace-rail-button" aria-label="Dashboard"><Home className="size-4" /></Link>
          <button type="button" className="workspace-rail-button is-active" aria-label="Project chat"><MessageSquare className="size-4" /></button>
        </div>
        <Link href="/" className="mt-auto rounded-full" aria-label={`${viewer.name} account and dashboard`}><UserAvatar viewer={viewer} className="size-8" /></Link>
      </aside>

      <Group orientation={isCompact ? "vertical" : "horizontal"} className="min-w-0 flex-1" id="cognix-workspace">
        <Panel id="chat" defaultSize={isCompact ? "52%" : "34%"} minSize={isCompact ? "240px" : "340px"} maxSize={isCompact ? "72%" : "48%"}>
          <section className="chat-panel">
            <header className="chat-header">
              <div className="min-w-0">
                <h1 className="truncate text-[13px] font-semibold">{project.title}</h1>
                <p className="mt-0.5 text-[10px] text-white/38">{project.status === "building" ? "Building now" : project.status === "publishing" ? "Publishing production" : project.status === "error" ? "Build needs attention" : project.publishedAt && project.status !== "published" ? "Changes ready to publish" : project.publishedAt ? "Published" : "All changes saved"}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-white/35"><History className="size-3.5" /> Saved automatically</span>
            </header>

            <div className="chat-scroll" aria-live="polite">
              {messages.map((message, messageIndex) => {
                const summary = typeof message.metadata.summary === "string" ? message.metadata.summary : null;
                const changedPaths = changedPathsFor(message);
                const messageFileChanges = fileChangesFor(message);
                const changeSummary = summary ?? (changedPaths.length
                  ? `Updated ${changedPaths.length} ${changedPaths.length === 1 ? "file" : "files"}`
                  : null);
                const isStreamingMessage = message.metadata.streaming === true;
                const messageImages = message.role === "user" ? imageAttachmentsFor(message) : [];
                const messageSelections = message.role === "user" ? visualSelectionsFor(message) : [];
                const checkpoint = checkpointCanRestore(message);
                const wasRestored = typeof message.metadata.restoredAt === "string";
                const previousUserMessage = message.metadata.error === true
                  ? [...messages.slice(0, messageIndex)].reverse().find((item) => item.role === "user")
                  : undefined;
                const isToolLimitError = message.metadata.error === true
                  && /reached its tool limit|execution budget/i.test(message.content);
                return (
                  <article key={message.id} className={cn("chat-message", message.role === "user" ? "is-user" : "is-assistant")}>
                    {message.role === "user" ? (
                      <div className="user-message-bubble"><MessageImages images={messageImages} /><VisualSelectionReferences selections={messageSelections} /><UserMessageContent content={message.content} /></div>
                    ) : (
                      <div className="assistant-message-body">
                        {message.content ? <AssistantMessageContent content={assistantContent(message)} /> : isStreamingMessage ? <span className="inline-flex items-center gap-2 text-white/45"><span className="spinner" /> Thinking…</span> : null}
                        {changeSummary ? (
                          <div className="change-summary-card">
                            <div className="flex items-center gap-2">
                              <span className="grid size-6 place-items-center rounded-md bg-emerald-400/12 text-emerald-300"><Check className="size-3.5" /></span>
                              <strong>{changeSummary}</strong>
                              {wasRestored ? <span className="checkpoint-restored">Restored</span> : null}
                            </div>
                            {changedPaths.length ? (
                              <ul className="changed-path-list">
                                {changedPaths.slice(0, 5).map((filePath) => {
                                  const wasDeleted = messageFileChanges.find((change) => change.path === filePath)?.after === null;
                                  return (
                                    <li key={filePath}>
                                      <button type="button" disabled={wasDeleted} onClick={() => openFile(filePath)}>
                                        <code>{filePath}</code>{wasDeleted ? <span>deleted</span> : null}
                                      </button>
                                    </li>
                                  );
                                })}
                                {changedPaths.length > 5 ? <li>+{changedPaths.length - 5} more</li> : null}
                              </ul>
                            ) : null}
                            <div className={cn("mt-3 grid gap-2", checkpoint.canRestore ? "grid-cols-3" : "grid-cols-2")}>
                              <button type="button" onClick={() => openDetails(message)} disabled={!changedPaths.length} title={changedPaths.length ? "Review edited files" : "No files changed in this build"}>Details</button>
                              <button type="button" onClick={() => setMode("preview")}>Preview</button>
                              {checkpoint.canRestore ? (
                                <button
                                  type="button"
                                  className="checkpoint-restore-button"
                                  onClick={() => void restoreCheckpoint(message)}
                                  disabled={Boolean(restoringMessageId) || isBuilding}
                                  title="Revert the files changed by this build"
                                >
                                  {restoringMessageId === message.id ? <LoaderCircle className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                                  {restoringMessageId === message.id ? "Restoring" : "Restore"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        <RunDetails message={message} />
                        {message.metadata.error === true && previousUserMessage ? (
                          <button
                            type="button"
                            className="retry-build-button"
                            disabled={isBuilding}
                            onClick={() => void submitPrompt(
                              isToolLimitError
                                ? "Continue and complete the previous request from the existing project files. Inspect what is already implemented, finish the missing requirements, run checks, and repair the live preview."
                                : previousUserMessage.content,
                              attachmentIdsFor(previousUserMessage),
                              visualSelectionsFor(previousUserMessage),
                            )}
                          >
                            <RotateCcw className="size-3.5" /> {isToolLimitError ? "Continue build" : "Retry this build"}
                          </button>
                        ) : null}
                      </div>
                    )}
                    <time>{formatRelativeDate(message.createdAt, relativeNow)}</time>
                  </article>
                );
              })}

              {isBuilding && activities.length ? (
                <details className="agent-activity-card">
                  <summary title="Show build activity">
                    <span className="sr-only">Show build activity, {activities.length} steps</span>
                    <span className="activity-icon-strip" aria-hidden="true">
                      {visibleActivities.map((activity) => (
                        <span
                          key={activity.id}
                          className={cn("activity-icon", activity.status === "done" && "is-done")}
                          title={activity.label}
                        >
                          <ActivityIcon name={activity.name} running={activity.status === "running"} />
                        </span>
                      ))}
                    </span>
                    <ChevronDown className="activity-disclosure-icon size-3.5" aria-hidden="true" />
                  </summary>
                  <div className="agent-activity-list">
                    <p>Build activity</p>
                    {activities.map((activity) => (
                      <div key={activity.id} className="activity-row">
                        <span className={cn("activity-icon", activity.status === "done" && "is-done")}><ActivityIcon name={activity.name} running={activity.status === "running"} /></span>
                        <span className="truncate">{activity.label}</span>
                        {activity.status === "done" ? <Check className="ml-auto size-3.5 text-emerald-400" /> : null}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
              <div ref={chatEndRef} />
            </div>

            <div className="chat-composer-area">
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                {suggestions.map((suggestion) => <button key={suggestion} type="button" className="suggestion-chip" onClick={() => setPrompt(suggestion)}>{suggestion}</button>)}
              </div>
              <div
                className={cn("chat-composer", isDraggingUpload && "is-dragging")}
                onDragEnter={(event) => { event.preventDefault(); setIsDraggingUpload(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingUpload(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDraggingUpload(false);
                  addUploads(Array.from(event.dataTransfer.files));
                }}
              >
                {visualSelections.length ? (
                  <div className="visual-composer-context">
                    <div className="visual-composer-heading">
                      <span><MousePointer2 className="size-3" /> {visualSelections.length} selected {visualSelections.length === 1 ? "element" : "elements"}</span>
                      <button type="button" onClick={() => { setVisualSelections([]); postVisualState(visualEditEnabled, []); }}>Clear</button>
                    </div>
                    <VisualSelectionReferences
                      selections={visualSelections}
                      onRemove={(id) => setVisualSelections((current) => current.filter((selection) => selection.id !== id))}
                    />
                  </div>
                ) : null}
                {uploads.length ? (
                  <div className="pending-upload-list" aria-label="Files ready to send">
                    {uploads.map((item) => (
                      <PendingUpload
                        key={item.localId}
                        file={item.file}
                        status={item.status}
                        uploadedUrl={item.attachment ? `/api/uploads/${item.attachment.id}` : undefined}
                        onRemove={() => setUploads((current) => current.filter((upload) => upload.localId !== item.localId))}
                        onRetry={() => void uploadComposerAttachment(item.localId, item.file)}
                      />
                    ))}
                  </div>
                ) : null}
                <textarea
                  value={prompt}
                  rows={2}
                  placeholder="Ask Cognix…"
                  aria-label="Continue building this app"
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
                      addUploads(images);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitPrompt(prompt); }
                  }}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <input ref={fileInputRef} className="sr-only" type="file" multiple accept={acceptedUploads} onChange={(event) => { addUploads(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
                    <button type="button" className="icon-button size-8" aria-label="Attach files" onClick={() => fileInputRef.current?.click()}><Paperclip className="size-4" /></button>
                    <span className="composer-mode-label"><Sparkles className="size-3.5" /> Build mode</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="send-button"
                      onClick={() => void submitPrompt(prompt)}
                      disabled={!prompt.trim() || isBuilding || uploads.some((item) => item.status !== "uploaded")}
                      aria-label="Send prompt"
                      title={uploads.some((item) => item.status === "uploading") ? "Waiting for uploads" : uploads.some((item) => item.status === "error") ? "Retry or remove failed uploads" : "Send prompt"}
                    >
                      {isBuilding || uploads.some((item) => item.status === "uploading") ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
                    </button>
                  </div>
                </div>
                {isDraggingUpload ? <div className="chat-drop-overlay"><ImagePlus className="size-5" /> Drop images or files here</div> : null}
              </div>
            </div>
          </section>
        </Panel>

        <Separator className="workspace-resizer" />

        <Panel id="workbench" minSize={isCompact ? "180px" : "480px"}>
          <section className="workbench-panel">
            <header className="workbench-toolbar">
              {mode === "details" ? (
                <button type="button" className="details-back-button" onClick={() => setMode(detailsReturnMode)}><ArrowLeft className="size-3.5" /> Back</button>
              ) : (
                <div className="mode-tabs" role="tablist" aria-label="Workspace view">
                  <button type="button" role="tab" aria-label="Preview" aria-selected={mode === "preview"} className={cn("toolbar-expandable", mode === "preview" && "is-active")} onClick={() => setMode("preview")}><Monitor className="size-3.5" /><span className="toolbar-control-label">Preview</span></button>
                  <button type="button" role="tab" aria-label="Code" aria-selected={mode === "code"} className={cn("toolbar-expandable", mode === "code" && "is-active")} onClick={() => setMode("code")}><Code2 className="size-3.5" /><span className="toolbar-control-label">Code</span></button>
                </div>
              )}

              {mode === "preview" ? (
                <>
                  <label className="preview-device-select toolbar-expandable" title="Preview viewport">
                    <PreviewDeviceIcon device={previewDevice} />
                    <span className="toolbar-control-label">{previewDevice === "phone" ? "Phone" : previewDevice === "tablet" ? "Tablet" : "Desktop"}</span>
                    <select value={previewDevice} onChange={(event) => setPreviewDevice(event.target.value as PreviewDevice)} aria-label="Preview device">
                      <option value="phone">Phone</option>
                      <option value="tablet">Tablet</option>
                      <option value="desktop">Desktop</option>
                    </select>
                    <ChevronDown className="size-3" aria-hidden="true" />
                  </label>
                  <button
                    type="button"
                    className={cn("visual-edit-button toolbar-expandable", visualEditEnabled && "is-active")}
                    onClick={() => void toggleVisualEdit()}
                    disabled={!currentPreviewUrl || visualEditConnecting}
                    aria-pressed={visualEditEnabled}
                    aria-label={visualEditEnabled ? "Exit element selection" : "Select preview elements"}
                    title={visualEditEnabled ? "Exit element selection" : "Select elements in the preview"}
                  >
                    {visualEditConnecting ? <LoaderCircle className="size-3.5 animate-spin" /> : <MousePointer2 className="size-3.5" />}
                    <span className="toolbar-control-label">{visualEditEnabled ? "Done" : "Select"}</span>
                  </button>
                  <div className="preview-address">
                    <button type="button" aria-label="Refresh preview" onClick={() => void refreshPreview()} disabled={isPreviewReconnecting}><RefreshCw className={cn("size-3.5", isPreviewReconnecting && "animate-spin")} /></button>
                    <span>{projectHost}</span>
                    {currentPreviewUrl ? <a href={currentPreviewUrl} target="_blank" rel="noreferrer" aria-label="Open preview in a new tab"><ExternalLink className="size-3.5" /></a> : null}
                  </div>
                </>
              ) : <strong className="text-[12px]">{mode === "details" ? "Changes" : "Code"}</strong>}

              <div className="ml-auto flex items-center gap-1.5">
                {project.sandboxId ? (
                  <a
                    className="toolbar-button toolbar-expandable"
                    href={`/api/projects/${project.id}/export`}
                    download
                    aria-label="Download project"
                    title="Download the project source without dependencies or secrets"
                  >
                    <Download className="size-3.5" /><span className="toolbar-control-label">Download</span>
                  </a>
                ) : (
                  <button type="button" className="toolbar-button toolbar-expandable" disabled aria-label="Download project" title="Build the app before downloading it">
                    <Download className="size-3.5" /><span className="toolbar-control-label">Download</span>
                  </button>
                )}
                <button type="button" className="toolbar-button toolbar-expandable" onClick={() => void shareProject()} disabled={!currentPreviewUrl} aria-label="Share preview" title={currentPreviewUrl ? "Copy preview link" : "Build the app to enable sharing"}><Share2 className="size-3.5" /><span className="toolbar-control-label">Share</span></button>
                <button
                  ref={publishButtonRef}
                  type="button"
                  className="publish-button toolbar-expandable"
                  onClick={() => {
                    setPublishSlug(project.publishSlug ?? publishSlugFromTitle(project.title));
                    setPublishDialogOpen(true);
                  }}
                  disabled={!canPublish || isBuilding || isPublishing}
                  aria-label={project.status === "publishing" ? "Publishing app" : project.publishedAt ? "Manage publication" : "Publish app"}
                  title={project.status === "publishing" ? "Reconnect to the production deployment" : canPublish ? "Build and manage a permanent publication" : "Build the app before publishing"}
                >
                  {project.status === "publishing" || isPublishing ? <LoaderCircle className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
                  <span className="toolbar-control-label">{project.status === "publishing" || isPublishing ? "Publishing" : project.publishedAt ? "Published" : "Publish"}</span>
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1">
              {mode === "preview" ? (
                currentPreviewUrl && !isPreviewReconnecting ? (
                  <div className={cn("preview-frame-wrap", `is-${previewDevice}`)}>
                    <div className="preview-device-stage">
                      <iframe
                        key={`${currentPreviewUrl}:${previewRevision}`}
                        ref={previewFrameRef}
                        title={`${project.title} ${previewDevice} preview`}
                        src={currentPreviewUrl}
                        sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
                        onLoad={() => postVisualState(visualEditEnabled, visualSelections)}
                      />
                    </div>
                    {visualEditEnabled ? (
                      <div className={cn("visual-edit-hint", !visualBridgeReady && "is-connecting")}>
                        {visualBridgeReady ? <MousePointer2 className="size-3.5" /> : <LoaderCircle className="size-3.5 animate-spin" />}
                        <span>{visualBridgeReady ? "Click an element · Ctrl/Cmd-click to add · Esc to exit" : "Connecting element selector…"}</span>
                      </div>
                    ) : null}
                    <div className="preview-floating-tools"><button type="button" aria-label="Copy preview URL" title="Copy preview URL" onClick={() => { void navigator.clipboard.writeText(currentPreviewUrl); toast.success("Preview link copied."); }}><Copy className="size-4" /></button></div>
                  </div>
                ) : <PreviewPlaceholder reconnecting={isPreviewReconnecting} />
              ) : mode === "code" ? (
                <CodeWorkbench
                  projectId={project.id}
                  files={files}
                  selectedPath={selectedCodePath}
                  onSelectPath={openFile}
                  onFilesChange={setFiles}
                />
              ) : detailsMessage ? (
                <ChangeDetails
                  changedPaths={changedPathsFor(detailsMessage)}
                  fileChanges={fileChangesFor(detailsMessage)}
                  files={files}
                  selectedPath={detailsPath}
                  onSelectPath={setDetailsPath}
                  onOpenFile={openFile}
                />
              ) : null}
            </div>
          </section>
        </Panel>
      </Group>
    </div>
  );
}
