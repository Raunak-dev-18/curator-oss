import path from "node:path";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ensureSandbox, getPreviewHealth, getPreviewUrl, getProjectFsRoot, getProjectRoot } from "../daytona";
import { createMessage, updateAttachmentSandboxPath, updateProject } from "../store";
import { createSignedObjectReadUrl, downloadObject } from "../storage";
import type {
  AgentEvent,
  AgentRunActivity,
  Attachment,
  FileChangeSnapshot,
  Message,
  Project,
  VisualElementSelection,
} from "../types";
import { safeFileName } from "../utils";
import { ensureVisualEditBridge } from "../visual-edit-bridge";
import { isProductionBuildCommand, resolveAgentMaxTurns, shouldRefreshAgentContext } from "./agent-policy";
import { buildSystemPrompt } from "./system-prompt";
import { buildMultimodalUserContent, hasNativeFileParts } from "./multimodal";
import { agentTools, executeAgentTool } from "./tools";

export const isAgentConfigured = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);

type Emit = (event: AgentEvent) => void | Promise<void>;

function parseToolInput(value: string) {
  if (!value.trim()) return {};
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { raw: value };
  }
}

function isNativeFileCompatibilityError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : undefined;
  const message = error instanceof Error ? error.message : "";
  return [400, 415, 422].includes(status ?? 0)
    || /unsupported.*file|file.*unsupported|invalid.*content.*type|content.*type.*file/i.test(message);
}

export async function runAgent(input: {
  project: Project;
  prompt: string;
  history: Message[];
  attachments: Attachment[];
  visualSelections: VisualElementSelection[];
  emit: Emit;
}) {
  const { emit, prompt } = input;

  if (!isAgentConfigured) {
    await emit({ type: "status", label: "Waiting for a model connection" });
    const content =
      "Cognix is ready to build this project, but the model connection is incomplete. Add OPENAI_API_KEY and OPENAI_MODEL (plus OPENAI_BASE_URL for your custom provider), then send this prompt again.";
    for (const chunk of content.match(/.{1,28}/g) ?? [content]) {
      await emit({ type: "token", value: chunk });
    }
    const message = await createMessage(input.project.id, "assistant", content, { configurationRequired: true });
    await emit({ type: "done", messageId: message.id });
    return message;
  }

  await emit({ type: "status", label: "Starting a secure workspace" });
  const { sandbox, project } = await ensureSandbox(input.project);
  const projectRoot = await getProjectRoot(sandbox);
  const projectFsRoot = getProjectFsRoot();
  await sandbox.process.executeCommand("mkdir -p app", path.posix.dirname(projectRoot), undefined, 30);
  await ensureVisualEditBridge(sandbox, projectRoot, projectFsRoot).catch(() => null);
  await emit({ type: "status", label: "Inspecting the project" });
  const runStartedAt = Date.now();
  const runActivity: AgentRunActivity[] = [];

  const stagedAttachments = await Promise.all(
    input.attachments.map(async (attachment) => {
      const activityStartedAt = Date.now();
      const sandboxName = `${attachment.id}-${safeFileName(attachment.name)}`;
      const relativeUploadPath = `uploads/${sandboxName}`;
      const appAssetPath = `public/user-uploads/${sandboxName}`;
      const appAssetUrl = `/user-uploads/${sandboxName}`;
      await emit({ type: "attachment_start", id: attachment.id, path: relativeUploadPath });
      const [buffer, modelUrl] = await Promise.all([
        downloadObject(attachment.objectKey),
        createSignedObjectReadUrl(attachment.objectKey).catch(() => null),
      ]);
      const sandboxPath = attachment.sandboxPath ?? `${projectRoot}/uploads/${sandboxName}`;
      await sandbox.process.executeCommand("mkdir -p uploads public/user-uploads", projectRoot, undefined, 30);
      if (!attachment.sandboxPath) {
        await sandbox.fs.uploadFile(buffer, `${projectFsRoot}/uploads/${sandboxName}`);
        await updateAttachmentSandboxPath(attachment.id, sandboxPath);
      }
      await sandbox.fs.uploadFile(buffer, `${projectFsRoot}/${appAssetPath}`);
      await emit({ type: "attachment_ready", id: attachment.id, path: relativeUploadPath, appUrl: appAssetUrl });
      runActivity.push({
        id: `attachment-${attachment.id}`,
        name: "read_attachment",
        label: `Prepared ${attachment.name}`,
        status: "done",
        durationMs: Date.now() - activityStartedAt,
      });
      return { attachment: { ...attachment, sandboxPath }, buffer, modelUrl, appAssetPath, appAssetUrl };
    }),
  );

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    defaultHeaders: { "User-Agent": "Cognix/1.0" },
  });

  const history: ChatCompletionMessageParam[] = input.history
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-20)
    .map((message) =>
      message.role === "user"
        ? ({ role: "user", content: message.content } satisfies ChatCompletionMessageParam)
        : ({ role: "assistant", content: message.content } satisfies ChatCompletionMessageParam),
    );

  let messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(project, projectRoot, stagedAttachments.map((item) => item.attachment)) },
    ...history,
    {
      role: "user",
      content: buildMultimodalUserContent(prompt, stagedAttachments, { visualSelections: input.visualSelections }),
    },
  ];
  const currentUserMessageIndex = messages.length - 1;
  let nativeFilePartsEnabled = hasNativeFileParts(stagedAttachments);

  const usedTools: string[] = [];
  const changedPaths = new Set<string>();
  const fileChanges = new Map<string, FileChangeSnapshot>();
  let finalContent = "";
  let previewReady = false;
  let productionBuildPassed = false;
  let completionNudges = 0;
  const maxAgentTurns = resolveAgentMaxTurns();

  let completedNaturally = false;
  for (let turn = 0; turn < maxAgentTurns; turn += 1) {
    if (shouldRefreshAgentContext(turn)) {
      const changedFiles = [...changedPaths];
      messages = [
        messages[0],
        {
          role: "user",
          content: [
            "Continue the current build from the files already present in the sandbox.",
            `Original request: ${prompt}`,
            changedFiles.length
              ? `Files changed so far: ${changedFiles.slice(-80).join(", ")}`
              : "No file changes have been recorded yet.",
            "Re-inspect only the files needed for the remaining work. Do not recreate or overwrite working features unnecessarily.",
            "Finish the requested app, run its full production build and fix every build failure, then start or repair the server on 0.0.0.0:3000, inspect the preview, and call get_preview_url.",
          ].join("\n\n"),
        },
      ];
      completionNudges = 0;
      await emit({ type: "status", label: "Continuing with a focused build context" });
    }

    const createStream = () => client.chat.completions.create({
      model: process.env.OPENAI_MODEL!,
      messages,
      tools: agentTools,
      tool_choice: "auto",
      stream: true,
      temperature: 0.2,
    });
    let stream;
    try {
      stream = await createStream();
    } catch (error) {
      if (!nativeFilePartsEnabled || turn !== 0 || !isNativeFileCompatibilityError(error)) throw error;
      nativeFilePartsEnabled = false;
      messages[currentUserMessageIndex] = {
        role: "user",
        content: buildMultimodalUserContent(prompt, stagedAttachments, {
          includeNativeFiles: false,
          visualSelections: input.visualSelections,
        }),
      };
      await emit({ type: "status", label: "Opening attachments in compatibility mode" });
      stream = await createStream();
    }

    let content = "";
    const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        content += delta.content;
      }
      for (const toolDelta of delta.tool_calls ?? []) {
        const current = toolCalls.get(toolDelta.index) ?? { id: "", name: "", arguments: "" };
        current.id += toolDelta.id ?? "";
        current.name += toolDelta.function?.name ?? "";
        current.arguments += toolDelta.function?.arguments ?? "";
        toolCalls.set(toolDelta.index, current);
      }
    }

    const calls = [...toolCalls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, call]) => ({
        id: call.id || crypto.randomUUID(),
        type: "function" as const,
        function: { name: call.name, arguments: call.arguments },
      }));

    messages.push({
      role: "assistant",
      content: content || null,
      ...(calls.length ? { tool_calls: calls } : {}),
    });

    if (!calls.length) {
      if ((!previewReady || !productionBuildPassed) && completionNudges < 2 && turn < maxAgentTurns - 1) {
        completionNudges += 1;
        messages.push({
          role: "user",
          content:
            "The task is not complete yet. Continue using tools: verify the files are in the project root, install dependencies, run the full production build and fix it until it exits successfully, review any affected UI against the 390 px phone, 768 px tablet, and 1440 px desktop layout contract, then start the development server on 0.0.0.0:3000, confirm it responds, and call get_preview_url. A development preview does not replace the production build.",
        });
        continue;
      }
      finalContent = content.trim();
      completedNaturally = true;
      break;
    }

    for (const call of calls) {
      const toolInput = parseToolInput(call.function.arguments);
      const activityStartedAt = Date.now();
      usedTools.push(call.function.name);
      await emit({ type: "tool_start", id: call.id, name: call.function.name, input: toolInput });

      let toolOutput: string;
      try {
        const result = await executeAgentTool(project, sandbox, call.function.name, toolInput);
        if (["write_file", "edit_file", "move_file", "delete_file", "run_command"].includes(call.function.name)) {
          previewReady = false;
        }
        if (["write_file", "edit_file", "move_file", "delete_file"].includes(call.function.name)) {
          productionBuildPassed = false;
        }
        if (call.function.name === "run_command") {
          const command = typeof toolInput === "object" && toolInput && "command" in toolInput
            ? String(toolInput.command)
            : "";
          if (isProductionBuildCommand(command)) {
            try {
              const commandResult = JSON.parse(result.output) as { exitCode?: number };
              productionBuildPassed = commandResult.exitCode === 0;
            } catch {
              productionBuildPassed = false;
            }
          }
        }
        toolOutput = result.output;
        result.changedPaths?.forEach((filePath) => changedPaths.add(filePath));
        result.fileChanges?.forEach((change) => {
          const existing = fileChanges.get(change.path);
          fileChanges.set(change.path, existing
            ? {
                path: change.path,
                before: existing.before,
                after: change.after,
                ...(existing.truncated || change.truncated ? { truncated: true } : {}),
              }
            : change);
        });
        await emit({ type: "tool_result", id: call.id, name: call.function.name, summary: result.summary });
        if (result.changedPaths?.length) await emit({ type: "files_changed", paths: result.changedPaths });
        if (result.previewUrl) await emit({ type: "preview", url: result.previewUrl, sandboxId: sandbox.id });
        if (result.previewUrl) previewReady = true;
        runActivity.push({
          id: call.id,
          name: call.function.name,
          label: result.summary,
          status: "done",
          durationMs: Date.now() - activityStartedAt,
        });
      } catch (error) {
        const failure = error instanceof Error ? error.message : "Tool failed";
        toolOutput = JSON.stringify({ error: error instanceof Error ? error.message : "Tool failed" });
        await emit({
          type: "tool_result",
          id: call.id,
          name: call.function.name,
          summary: `Needs attention: ${failure}`,
        });
        runActivity.push({
          id: call.id,
          name: call.function.name,
          label: `Needs attention: ${failure}`.slice(0, 500),
          status: "error",
          durationMs: Date.now() - activityStartedAt,
        });
      }

      messages.push({ role: "tool", tool_call_id: call.id, content: toolOutput });
    }
  }

  if (!completedNaturally) {
    await emit({ type: "status", label: "Saving the build and verifying the preview" });
    finalContent = [
      "## Build checkpoint",
      "",
      "Cognix used the available execution budget and saved every completed file change.",
      "",
      "The live app has been verified below. You can continue refining it with another instruction without starting over.",
    ].join("\n");
  }

  await emit({ type: "status", label: "Finishing the live preview" });
  const packageCheck = await sandbox.process.executeCommand("test -f package.json", projectRoot, undefined, 10);
  if (packageCheck.exitCode !== 0) throw new Error("The generated app is missing package.json. Ask Cognix to repair the project and try again.");
  await ensureVisualEditBridge(sandbox, projectRoot, projectFsRoot).catch(() => null);

  let health = await getPreviewHealth(sandbox, 3000);
  if (!health.healthy) {
    await emit({ type: "status", label: "Installing app dependencies" });
    const install = await sandbox.process.executeCommand("npm install --include=dev --no-audit --no-fund", projectRoot, { CI: "1" }, 360);
    if (install.exitCode !== 0) throw new Error(`Dependency installation failed:\n${install.result.slice(-4000)}`);
    health = await getPreviewHealth(sandbox, 3000);

    if (health.reachable && !health.healthy) {
      await sandbox.process.executeCommand(
        "for i in $(seq 1 15); do status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:3000/ || true); case \"$status\" in 2*|3*) exit 0 ;; 000) exit 1 ;; esac; sleep 2; done; exit 1",
        projectRoot,
        undefined,
        40,
      );
      health = await getPreviewHealth(sandbox, 3000);
      if (health.reachable && !health.healthy) {
        throw new Error(`The development server is running but its home page returns HTTP ${health.status}. Fix the runtime error before publishing a preview.`);
      }
    }

    if (!health.healthy) {
      const sessionId = `cognix-preview-${project.id.slice(0, 12)}`;
      try {
        await sandbox.process.getSession(sessionId);
      } catch {
        await sandbox.process.createSession(sessionId);
      }
      await emit({ type: "status", label: "Starting the development server" });
      const command = await sandbox.process.executeSessionCommand(
        sessionId,
        {
          command: `cd ${JSON.stringify(projectRoot)} && npm run dev -- --hostname 0.0.0.0 --port 3000`,
          runAsync: true,
          suppressInputEcho: true,
        },
        30,
      );
      const healthWait = await sandbox.process.executeCommand(
        "for i in $(seq 1 50); do status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:3000/ || true); case \"$status\" in 2*|3*) exit 0 ;; esac; sleep 2; done; exit 1",
        projectRoot,
        undefined,
        110,
      );
      if (healthWait.exitCode !== 0) {
        const logs = await sandbox.process.getSessionCommandLogs(sessionId, command.cmdId);
        const output = [logs.stdout, logs.stderr, logs.output].filter(Boolean).join("\n").slice(-5000);
        throw new Error(`The development server did not start:\n${output || "No server output was captured."}`);
      }
      health = await getPreviewHealth(sandbox, 3000);
      if (!health.healthy) {
        throw new Error(`The development server started but its home page returns HTTP ${health.status}.`);
      }
    }
  }

  const previewUrl = await getPreviewUrl({ ...project, sandboxId: sandbox.id }, 3000);
  if (!previewUrl) throw new Error("Daytona could not create a preview URL for port 3000.");
  await updateProject(project.id, project.ownerId, { previewUrl, status: "ready" });
  await emit({ type: "preview", url: previewUrl, sandboxId: sandbox.id });
  previewReady = true;

  if (!finalContent.trim()) {
    finalContent = "## What changed\n\nThe requested update is implemented in the existing app.\n\n## Checks\n\n- The development server is healthy.\n- The live preview is ready.";
  }
  await emit({ type: "token", value: finalContent });

  const changedPathList = [...changedPaths];
  const fileChangeList = [...fileChanges.values()];
  const completedAt = new Date();
  const message = await createMessage(project.id, "assistant", finalContent, {
    tools: usedTools,
    activity: runActivity.slice(-100),
    runStartedAt: new Date(runStartedAt).toISOString(),
    runCompletedAt: completedAt.toISOString(),
    runDurationMs: completedAt.getTime() - runStartedAt,
    changedPaths: changedPathList,
    fileChanges: fileChangeList,
    summary: changedPathList.length
      ? `Updated ${changedPathList.length} ${changedPathList.length === 1 ? "file" : "files"}`
      : "Verified the existing app",
  });
  await updateProject(project.id, project.ownerId, { status: previewReady ? "ready" : "error" });
  await emit({
    type: "done",
    messageId: message.id,
    changedPaths: changedPathList,
    fileChanges: fileChangeList,
    activity: runActivity.slice(-100),
    runDurationMs: completedAt.getTime() - runStartedAt,
  });
  return message;
}
