export type ProjectStatus = "draft" | "building" | "publishing" | "ready" | "published" | "error";

export type Project = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  status: ProjectStatus;
  coverGradient: string;
  sandboxId: string | null;
  previewUrl: string | null;
  publishSlug: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageRole = "user" | "assistant" | "tool";

export type Message = {
  id: string;
  projectId: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ProjectFile = {
  id: string;
  projectId: string;
  path: string;
  content: string | null;
  size: number;
  updatedAt: string;
};

export type FileChangeSnapshot = {
  path: string;
  before: string | null;
  after: string | null;
  truncated?: boolean;
};

export type AgentRunActivity = {
  id: string;
  name: string;
  label: string;
  status: "done" | "error";
  durationMs: number;
};

export type Attachment = {
  id: string;
  projectId: string;
  ownerId: string;
  name: string;
  contentType: string;
  size: number;
  objectKey: string;
  sandboxPath: string | null;
  createdAt: string;
};

export type Viewer = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
};

export type VisualElementSource = {
  file: string;
  line?: number;
  column?: number;
};

export type VisualElementComponent = {
  name: string;
  source?: VisualElementSource;
};

export type VisualElementSelection = {
  id: string;
  route: string;
  selector: string;
  tagName: string;
  role?: string;
  accessibleName?: string;
  text?: string;
  attributes: Record<string, string>;
  rect: { x: number; y: number; width: number; height: number };
  viewport: { width: number; height: number };
  styles?: {
    display?: string;
    position?: string;
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    fontWeight?: string;
    borderRadius?: string;
  };
  componentStack?: VisualElementComponent[];
};

export type AgentEvent =
  | { type: "heartbeat"; at: string }
  | { type: "status"; label: string }
  | { type: "token"; value: string }
  | { type: "tool_start"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; summary: string }
  | { type: "attachment_start"; id: string; path: string }
  | { type: "attachment_ready"; id: string; path: string; appUrl: string }
  | { type: "preview"; url: string; sandboxId?: string }
  | { type: "files_changed"; paths: string[] }
  | {
      type: "done";
      messageId: string;
      changedPaths?: string[];
      fileChanges?: FileChangeSnapshot[];
      activity?: AgentRunActivity[];
      runDurationMs?: number;
    }
  | { type: "error"; message: string };
