import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import path from "node:path";
import type { Sandbox } from "@daytona/sdk";
import { z } from "zod";
import { getPreviewHealth, getPreviewUrl, getProjectFsRoot, getProjectRoot } from "../daytona";
import { deleteProjectFile, upsertProjectFile, updateProject } from "../store";
import type { FileChangeSnapshot, Project } from "../types";

export const agentTools = [
  {
    type: "function" as const,
    function: {
      name: "list_files",
      description: "List project files and directories. Use this before editing an unfamiliar project.",
      parameters: {
        type: "object",
        properties: {
          directory: { type: "string", description: "Project-relative directory. Defaults to the project root." },
          depth: { type: "integer", minimum: 1, maximum: 8, description: "Maximum tree depth." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_files",
      description: "Find files by a case-insensitive filename glob. Use this when you know part of a filename but not its directory.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Filename glob such as '*auth*', '*.tsx', or 'route.*'." },
          directory: { type: "string", description: "Project-relative directory. Defaults to the project root." },
          maxResults: { type: "integer", minimum: 1, maximum: 500 },
        },
        required: ["pattern"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Read a UTF-8 text file, optionally limiting output to a line range for focused inspection.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Project-relative file path." },
          startLine: { type: "integer", minimum: 1, description: "First line to return. Defaults to 1." },
          endLine: { type: "integer", minimum: 1, description: "Last line to return, inclusive." },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description: "Create or completely replace a UTF-8 text file in the project.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Project-relative file path." },
          content: { type: "string", description: "Complete file contents." },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "edit_file",
      description: "Surgically edit an existing UTF-8 file by replacing exact text. Read the file first and include enough surrounding text for a unique match.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Project-relative existing file path." },
          oldText: { type: "string", description: "Exact text currently in the file." },
          newText: { type: "string", description: "Replacement text." },
          replaceAll: { type: "boolean", description: "Replace every exact match. Defaults to false and requires one unique match." },
        },
        required: ["path", "oldText", "newText"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_files",
      description: "Search source text across the project with line numbers and optional regex, filename glob, and case matching.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Literal text by default, or a regular expression when regex=true." },
          directory: { type: "string", description: "Project-relative directory." },
          fileGlob: { type: "string", description: "Optional filename glob such as '*.tsx'." },
          regex: { type: "boolean", description: "Interpret query as an extended regular expression. Defaults to false." },
          caseSensitive: { type: "boolean", description: "Use case-sensitive matching. Defaults to false." },
          maxResults: { type: "integer", minimum: 1, maximum: 500 },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "move_file",
      description: "Move or rename one project text file while preserving review and restore history. The destination must not already exist.",
      parameters: {
        type: "object",
        properties: {
          source: { type: "string", description: "Existing project-relative file path." },
          destination: { type: "string", description: "New project-relative file path." },
        },
        required: ["source", "destination"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_file",
      description: "Delete one project file while preserving enough history to restore it. Never use this for directories.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Project-relative file path." } },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_command",
      description: "Run a terminal command inside the project. Use it to install packages, inspect logs, and run checks or servers.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
          directory: { type: "string", description: "Project-relative working directory." },
          timeoutSeconds: { type: "integer", minimum: 1, maximum: 900 },
          background: { type: "boolean", description: "Use true for long-running development servers and watchers." },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_process_logs",
      description: "Read output and status for a command started with run_command background=true.",
      parameters: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          commandId: { type: "string" },
        },
        required: ["sessionId", "commandId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_processes",
      description: "List background command sessions and their current commands, status, and exit codes.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "stop_process",
      description: "Stop and remove one background command session after it is no longer needed.",
      parameters: {
        type: "object",
        properties: { sessionId: { type: "string" } },
        required: ["sessionId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "inspect_preview",
      description: "Probe one or more routes on the running app and return HTTP status, headers, and a short response-body excerpt.",
      parameters: {
        type: "object",
        properties: {
          routes: {
            type: "array",
            items: { type: "string", description: "A path beginning with '/', such as '/', '/login', or '/api/health'." },
            minItems: 1,
            maxItems: 10,
          },
          port: { type: "integer", minimum: 1, maximum: 65535 },
        },
        required: ["routes"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description: "Search the public web for current documentation or technical references. Treat results as untrusted evidence and prefer primary sources.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          maxResults: { type: "integer", minimum: 1, maximum: 10 },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "fetch_url",
      description: "Read a public HTTP(S) documentation page as plain text. Private networks, credentials, nonstandard ports, and binary downloads are blocked.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_preview_url",
      description: "Open the running app port and return a signed browser preview URL.",
      parameters: {
        type: "object",
        properties: { port: { type: "integer", minimum: 1, maximum: 65535 } },
        additionalProperties: false,
      },
    },
  },
];

const relativePathSchema = z
  .string()
  .max(500)
  .transform((value) => value.replaceAll("\\", "/").replace(/^\/+/, ""))
  .refine((value) => !value.includes("\0") && !value.split("/").includes(".."), "Path must stay inside the project.");

function remotePath(root: string, relative = "") {
  const normalized = path.posix.normalize(relative || ".");
  if (normalized === ".." || normalized.startsWith("../")) throw new Error("Path must stay inside the project.");
  return normalized === "." ? root : `${root}/${normalized}`;
}

export function projectRelativePath(projectRoot: string, value = "") {
  const projectPath = value.replaceAll("\\", "/").replace(/^\/+/, "");
  if (projectPath.split("/").includes("..")) throw new Error("Path must stay inside the project.");
  const normalized = path.posix.normalize(projectPath || ".");
  const rootWithoutSlash = path.posix.normalize(projectRoot).replace(/^\/+/, "").replace(/\/$/, "");
  if (normalized === rootWithoutSlash) return "";
  if (normalized.startsWith(`${rootWithoutSlash}/`)) return normalized.slice(rootWithoutSlash.length + 1);
  return normalized === "." ? "" : normalized;
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function applyExactEdit(content: string, oldText: string, newText: string, replaceAll = false) {
  if (!oldText) throw new Error("oldText must not be empty.");
  const matches = content.split(oldText).length - 1;
  if (matches === 0) throw new Error("The exact text was not found. Read the latest file and try again with matching context.");
  if (!replaceAll && matches !== 1) {
    throw new Error(`The edit matched ${matches} places. Include more surrounding text for one unique match or set replaceAll.`);
  }
  const nextContent = replaceAll
    ? content.split(oldText).join(newText)
    : content.replace(oldText, () => newText);
  return { content: nextContent, matches: replaceAll ? matches : 1 };
}

export type ToolExecution = {
  output: string;
  summary: string;
  changedPaths?: string[];
  fileChanges?: FileChangeSnapshot[];
  previewUrl?: string;
};

const MAX_SNAPSHOT_CHARS = 200_000;

function fileChangeSnapshot(path: string, before: string | null, after: string | null): FileChangeSnapshot {
  const truncated = (before?.length ?? 0) > MAX_SNAPSHOT_CHARS || (after?.length ?? 0) > MAX_SNAPSHOT_CHARS;
  return {
    path,
    before: before === null ? null : before.slice(0, MAX_SNAPSHOT_CHARS),
    after: after === null ? null : after.slice(0, MAX_SNAPSHOT_CHARS),
    ...(truncated ? { truncated: true } : {}),
  };
}

function textFileContent(buffer: Buffer, pathname: string) {
  if (buffer.length > 1_000_000) throw new Error(`${pathname} is too large for a reviewable file operation.`);
  if (buffer.includes(0)) {
    throw new Error(`${pathname} appears to be binary. Use a terminal command only when the user explicitly requests a binary-file operation.`);
  }
  return buffer.toString("utf8");
}

export function isPrivateNetworkAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0
      || a === 10
      || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || a >= 224;
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return normalized === "::"
      || normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || /^fe[89ab]/.test(normalized)
      || normalized.startsWith("ff")
      || normalized.startsWith("::ffff:");
  }
  return true;
}

async function assertPublicUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only public HTTP(S) URLs can be fetched.");
  if (url.username || url.password) throw new Error("URLs containing credentials are not allowed.");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Only standard HTTP(S) ports are allowed.");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
  ) throw new Error("Private network URLs are not allowed.");
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateNetworkAddress(address))) {
    throw new Error("Private network URLs are not allowed.");
  }
  return url;
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function htmlToText(value: string) {
  return decodeHtml(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();
}

async function fetchPublicText(value: string, redirects = 0): Promise<{
  url: string;
  status: number;
  contentType: string;
  raw: string;
  text: string;
}> {
  if (redirects > 3) throw new Error("The page redirected too many times.");
  const url = await assertPublicUrl(value);
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: "text/html, text/plain, application/json, application/xml;q=0.9, */*;q=0.1",
      "User-Agent": "Cognix-Agent/1.0",
    },
  });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (!location) throw new Error(`The page redirected without a location (${response.status}).`);
    return fetchPublicText(new URL(location, url).toString(), redirects + 1);
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!/(?:text\/|application\/(?:json|xml|xhtml\+xml|javascript))/.test(contentType)) {
    throw new Error(`The URL returned unsupported content type ${contentType || "unknown"}.`);
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > 1_000_000) throw new Error("The page is too large to read safely.");
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (reader) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > 1_000_000) {
      await reader.cancel();
      throw new Error("The page is too large to read safely.");
    }
    chunks.push(chunk.value);
  }
  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  const raw = new TextDecoder().decode(bytes);
  return {
    url: response.url || url.toString(),
    status: response.status,
    contentType,
    raw,
    text: contentType.includes("html") ? htmlToText(raw) : raw.replace(/\s+/g, " ").trim(),
  };
}

export async function executeAgentTool(
  project: Project,
  sandbox: Sandbox,
  name: string,
  rawInput: unknown,
): Promise<ToolExecution> {
  const root = await getProjectRoot(sandbox);
  const fsRoot = getProjectFsRoot();

  if (name === "list_files") {
    const input = z
      .object({ directory: relativePathSchema.optional().default(""), depth: z.number().int().min(1).max(8).optional().default(4) })
      .parse(rawInput);
    const target = remotePath(root, projectRelativePath(root, input.directory));
    const response = await sandbox.process.executeCommand(
      `find . -maxdepth ${input.depth} -not -path './node_modules/*' -not -path './.next/*' -print | sort | head -500`,
      target,
      undefined,
      30,
    );
    return { output: response.result, summary: `Listed ${input.directory || "the project root"}` };
  }

  if (name === "find_files") {
    const input = z
      .object({
        pattern: z.string().min(1).max(200),
        directory: relativePathSchema.optional().default(""),
        maxResults: z.number().int().min(1).max(500).optional().default(100),
      })
      .parse(rawInput);
    const directory = projectRelativePath(root, input.directory);
    const response = await sandbox.process.executeCommand(
      `find . -type d \\( -name node_modules -o -name .next -o -name .git \\) -prune -o -type f -iname ${shellQuote(input.pattern)} -print | sort | head -n ${input.maxResults}`,
      remotePath(root, directory),
      undefined,
      30,
    );
    if (response.exitCode !== 0) throw new Error(`File discovery failed:\n${response.result.slice(-3000)}`);
    return {
      output: response.result.trim() || "No files matched.",
      summary: `Found files matching “${input.pattern}”`,
    };
  }

  if (name === "read_file") {
    const input = z
      .object({
        path: relativePathSchema,
        startLine: z.number().int().min(1).optional().default(1),
        endLine: z.number().int().min(1).optional(),
      })
      .refine((value) => value.endLine === undefined || value.endLine >= value.startLine, {
        message: "endLine must be greater than or equal to startLine.",
      })
      .parse(rawInput);
    const relative = projectRelativePath(root, input.path);
    const buffer = await sandbox.fs.downloadFile(remotePath(fsRoot, relative));
    const lines = buffer.toString("utf8").split("\n");
    const endLine = Math.min(input.endLine ?? lines.length, input.startLine + 1_999, lines.length);
    const content = lines.slice(input.startLine - 1, endLine).join("\n").slice(0, 200_000);
    return {
      output: content,
      summary: input.startLine === 1 && endLine === lines.length
        ? `Read ${input.path}`
        : `Read ${input.path}:${input.startLine}-${endLine}`,
    };
  }

  if (name === "write_file") {
    const input = z.object({ path: relativePathSchema, content: z.string().max(1_000_000) }).parse(rawInput);
    const relative = projectRelativePath(root, input.path);
    const target = remotePath(root, relative);
    const fsTarget = remotePath(fsRoot, relative);
    const directory = path.posix.dirname(target);
    const existing = await sandbox.process.executeCommand(`test -f ${shellQuote(target)}`, root, undefined, 10);
    const before = existing.exitCode === 0 ? (await sandbox.fs.downloadFile(fsTarget)).toString("utf8") : null;
    await sandbox.process.executeCommand(`mkdir -p ${shellQuote(directory)}`, root, undefined, 30);
    await sandbox.fs.uploadFile(Buffer.from(input.content), fsTarget);
    await upsertProjectFile(project.id, relative, input.content);
    return {
      output: `Wrote ${Buffer.byteLength(input.content)} bytes to ${input.path}`,
      summary: `Updated ${relative}`,
      changedPaths: [relative],
      fileChanges: [fileChangeSnapshot(relative, before, input.content)],
    };
  }

  if (name === "edit_file") {
    const input = z
      .object({
        path: relativePathSchema,
        oldText: z.string().min(1).max(500_000),
        newText: z.string().max(500_000),
        replaceAll: z.boolean().optional().default(false),
      })
      .parse(rawInput);
    const relative = projectRelativePath(root, input.path);
    const fsTarget = remotePath(fsRoot, relative);
    const buffer = await sandbox.fs.downloadFile(fsTarget);
    if (buffer.length > 1_000_000) throw new Error("This file is too large for a targeted text edit.");
    const edited = applyExactEdit(buffer.toString("utf8"), input.oldText, input.newText, input.replaceAll);
    await sandbox.fs.uploadFile(Buffer.from(edited.content), fsTarget);
    await upsertProjectFile(project.id, relative, edited.content);
    return {
      output: `Replaced ${edited.matches} exact ${edited.matches === 1 ? "match" : "matches"} in ${relative}`,
      summary: `Edited ${relative}`,
      changedPaths: [relative],
      fileChanges: [fileChangeSnapshot(relative, buffer.toString("utf8"), edited.content)],
    };
  }

  if (name === "search_files") {
    const input = z
      .object({
        query: z.string().min(1).max(500),
        directory: relativePathSchema.optional().default(""),
        fileGlob: z.string().min(1).max(200).optional(),
        regex: z.boolean().optional().default(false),
        caseSensitive: z.boolean().optional().default(false),
        maxResults: z.number().int().min(1).max(500).optional().default(100),
      })
      .parse(rawInput);
    const directory = projectRelativePath(root, input.directory);
    const flags = ["-R", "-I", "-n", input.regex ? "-E" : "-F", input.caseSensitive ? "" : "-i"].filter(Boolean).join(" ");
    const include = input.fileGlob ? `--include=${shellQuote(input.fileGlob)}` : "";
    const response = await sandbox.process.executeCommand(
      `grep ${flags} ${include} --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git -- ${shellQuote(input.query)} . | head -n ${input.maxResults}`,
      remotePath(root, directory),
      undefined,
      45,
    );
    if (![0, 1].includes(response.exitCode)) throw new Error(`Code search failed:\n${response.result.slice(-3000)}`);
    return {
      output: response.result.trim() || "No matches found.",
      summary: `Searched code for “${input.query}”`,
    };
  }

  if (name === "move_file") {
    const input = z.object({ source: relativePathSchema, destination: relativePathSchema }).parse(rawInput);
    const source = projectRelativePath(root, input.source);
    const destination = projectRelativePath(root, input.destination);
    if (!source || !destination || source === destination) throw new Error("Choose two different file paths.");
    const sourcePath = remotePath(fsRoot, source);
    const destinationPath = remotePath(fsRoot, destination);
    const content = textFileContent(await sandbox.fs.downloadFile(sourcePath), source);
    const destinationCheck = await sandbox.process.executeCommand(
      `test -e ${shellQuote(remotePath(root, destination))}`,
      root,
      undefined,
      10,
    );
    if (destinationCheck.exitCode === 0) {
      throw new Error(`${destination} already exists. Read it and choose an explicit edit instead.`);
    }
    await sandbox.process.executeCommand(
      `mkdir -p ${shellQuote(path.posix.dirname(remotePath(root, destination)))}`,
      root,
      undefined,
      30,
    );
    await sandbox.fs.moveFiles(sourcePath, destinationPath);
    await deleteProjectFile(project.id, source);
    await upsertProjectFile(project.id, destination, content);
    return {
      output: `Moved ${source} to ${destination}`,
      summary: `Moved ${source} → ${destination}`,
      changedPaths: [source, destination],
      fileChanges: [
        fileChangeSnapshot(source, content, null),
        fileChangeSnapshot(destination, null, content),
      ],
    };
  }

  if (name === "delete_file") {
    const input = z.object({ path: relativePathSchema }).parse(rawInput);
    const relative = projectRelativePath(root, input.path);
    if (!relative) throw new Error("A file path is required.");
    if (relative === "public/__cognix_visual_edit.js") {
      throw new Error("This Cognix-managed preview file cannot be deleted.");
    }
    const fsTarget = remotePath(fsRoot, relative);
    const content = textFileContent(await sandbox.fs.downloadFile(fsTarget), relative);
    await sandbox.fs.deleteFile(fsTarget);
    await deleteProjectFile(project.id, relative);
    return {
      output: `Deleted ${relative}`,
      summary: `Deleted ${relative}`,
      changedPaths: [relative],
      fileChanges: [fileChangeSnapshot(relative, content, null)],
    };
  }

  if (name === "run_command") {
    const input = z
      .object({
        command: z.string().min(1).max(20_000),
        directory: relativePathSchema.optional().default(""),
        timeoutSeconds: z.number().int().min(1).max(900).optional().default(180),
        background: z.boolean().optional().default(false),
      })
      .parse(rawInput);
    const directory = projectRelativePath(root, input.directory);
    if (input.background) {
      const sessionId = `cognix-${project.id.slice(0, 12)}`;
      try {
        await sandbox.process.getSession(sessionId);
      } catch {
        await sandbox.process.createSession(sessionId);
      }
      const response = await sandbox.process.executeSessionCommand(
        sessionId,
        {
          command: `cd ${shellQuote(remotePath(root, directory))} && ${input.command}`,
          runAsync: true,
          suppressInputEcho: true,
        },
        30,
      );
      return {
        output: JSON.stringify({ sessionId, commandId: response.cmdId, stdout: response.stdout, stderr: response.stderr }),
        summary: `Started background command: ${input.command.slice(0, 60)}`,
      };
    }
    const response = await sandbox.process.executeCommand(
      input.command,
      remotePath(root, directory),
      undefined,
      input.timeoutSeconds,
    );
    return {
      output: JSON.stringify({ exitCode: response.exitCode, output: response.result.slice(-100_000) }),
      summary: response.exitCode === 0 ? `Command completed: ${input.command.slice(0, 60)}` : `Command exited ${response.exitCode}`,
    };
  }

  if (name === "get_process_logs") {
    const input = z
      .object({
        sessionId: z.string().min(1).max(120),
        commandId: z.string().min(1).max(120),
      })
      .parse(rawInput);
    const [command, logs] = await Promise.all([
      sandbox.process.getSessionCommand(input.sessionId, input.commandId),
      sandbox.process.getSessionCommandLogs(input.sessionId, input.commandId),
    ]);
    const output = [logs.stdout, logs.stderr].filter(Boolean).join("\n").slice(-100_000);
    return {
      output: JSON.stringify({ exitCode: command.exitCode, output }),
      summary: command.exitCode == null ? "Background process is running" : `Background process exited ${command.exitCode}`,
    };
  }

  if (name === "list_processes") {
    z.object({}).parse(rawInput);
    const sessions = await sandbox.process.listSessions();
    const output = sessions.map((session) => ({
      sessionId: session.sessionId,
      commands: session.commands?.map((command) => ({
        commandId: command.id,
        command: command.command.slice(0, 500),
        exitCode: command.exitCode,
      })) ?? [],
    }));
    return {
      output: JSON.stringify(output),
      summary: `Listed ${sessions.length} background ${sessions.length === 1 ? "session" : "sessions"}`,
    };
  }

  if (name === "stop_process") {
    const input = z.object({ sessionId: z.string().min(1).max(120) }).parse(rawInput);
    await sandbox.process.deleteSession(input.sessionId);
    return { output: `Stopped ${input.sessionId}`, summary: `Stopped background session ${input.sessionId}` };
  }

  if (name === "inspect_preview") {
    const input = z
      .object({
        routes: z.array(z.string().min(1).max(500).regex(/^\//)).min(1).max(10),
        port: z.number().int().min(1).max(65535).optional().default(3000),
      })
      .parse(rawInput);
    const results = [];
    for (const route of input.routes) {
      const response = await sandbox.process.executeCommand(
        `curl -sS -i --max-time 12 ${shellQuote(`http://127.0.0.1:${input.port}${route}`)}`,
        root,
        undefined,
        15,
      );
      results.push({
        route,
        exitCode: response.exitCode,
        response: response.result.slice(0, 20_000),
      });
    }
    return {
      output: JSON.stringify(results),
      summary: `Inspected ${results.length} preview ${results.length === 1 ? "route" : "routes"}`,
    };
  }

  if (name === "web_search") {
    const input = z
      .object({ query: z.string().min(1).max(500), maxResults: z.number().int().min(1).max(10).optional().default(5) })
      .parse(rawInput);
    const search = await fetchPublicText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(input.query)}`);
    const results: Array<{ title: string; url: string }> = [];
    const pattern = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const match of search.raw.matchAll(pattern)) {
      let resultUrl = decodeHtml(match[1]);
      try {
        const parsed = new URL(resultUrl, "https://duckduckgo.com");
        resultUrl = parsed.searchParams.get("uddg") ?? parsed.toString();
      } catch {
        continue;
      }
      if (!/^https?:\/\//i.test(resultUrl)) continue;
      results.push({ title: htmlToText(match[2]), url: resultUrl });
      if (results.length >= input.maxResults) break;
    }
    return {
      output: JSON.stringify(results.length ? results : [{ message: "No search results were returned. Try a narrower query." }]),
      summary: `Searched the web for “${input.query}”`,
    };
  }

  if (name === "fetch_url") {
    const input = z.object({ url: z.string().url().max(2_000) }).parse(rawInput);
    const page = await fetchPublicText(input.url);
    return {
      output: JSON.stringify({
        url: page.url,
        status: page.status,
        contentType: page.contentType,
        text: page.text.slice(0, 100_000),
      }),
      summary: `Fetched ${new URL(page.url).hostname}`,
    };
  }

  if (name === "get_preview_url") {
    const input = z.object({ port: z.number().int().min(1).max(65535).optional().default(3000) }).parse(rawInput);
    const health = await getPreviewHealth(sandbox, input.port);
    if (!health.healthy) {
      const reason = health.reachable ? `returned HTTP ${health.status}` : "is not accepting connections";
      throw new Error(`The app ${reason} on port ${input.port}. Read the server logs and fix it before requesting a preview.`);
    }
    const previewUrl = await getPreviewUrl({ ...project, sandboxId: sandbox.id }, input.port);
    if (!previewUrl) throw new Error("Start the app before requesting a preview.");
    await updateProject(project.id, project.ownerId, { previewUrl, status: "ready" });
    return { output: previewUrl, summary: `Preview is ready on port ${input.port}`, previewUrl };
  }

  throw new Error(`Unknown tool: ${name}`);
}
