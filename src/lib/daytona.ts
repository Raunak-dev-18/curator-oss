import path from "node:path";
import { CodeLanguage, Daytona, type Sandbox } from "@daytona/sdk";
import type { Project } from "./types";
import { updateProject } from "./store";

export const isDaytonaConfigured = Boolean(process.env.DAYTONA_API_KEY);

let client: Daytona | null = null;
const PUBLISHED_PORT = 3001;
const PREVIEW_URL_TTL_SECONDS = 60 * 60;
const PREVIEW_PROXY_VERIFY_ATTEMPTS = 5;

function getClient() {
  if (!process.env.DAYTONA_API_KEY) {
    throw new Error("Add DAYTONA_API_KEY to start a secure build sandbox.");
  }
  if (!client) {
    client = new Daytona({
      apiKey: process.env.DAYTONA_API_KEY,
      apiUrl: process.env.DAYTONA_API_URL,
      target: process.env.DAYTONA_TARGET,
    });
  }
  return client;
}

export async function getSandbox(project: Project): Promise<Sandbox | null> {
  if (!project.sandboxId) return null;
  const sandbox = await getClient().get(project.sandboxId);
  if (String(sandbox.state) !== "started") await sandbox.start(90);
  return sandbox;
}

export async function ensureSandbox(project: Project): Promise<{ sandbox: Sandbox; project: Project }> {
  const existing = await getSandbox(project);
  if (existing) {
    const updated = await updateProject(project.id, project.ownerId, { status: "building" });
    return { sandbox: existing, project: updated ?? { ...project, status: "building" } };
  }

  const sandbox = await getClient().create(
    {
      name: `cognix-${project.id.slice(0, 8)}`,
      image: "node:22-bookworm",
      language: CodeLanguage.TYPESCRIPT,
      public: true,
      autoStopInterval: 30,
      autoArchiveInterval: 1440,
      labels: { app: "cognix", projectId: project.id },
      envVars: { CI: "1", NEXT_TELEMETRY_DISABLED: "1" },
    },
    { timeout: 180 },
  );

  const updated = await updateProject(project.id, project.ownerId, {
    sandboxId: sandbox.id,
    status: "building",
  });
  return { sandbox, project: updated ?? { ...project, sandboxId: sandbox.id, status: "building" } };
}

export async function getProjectRoot(sandbox: Sandbox) {
  const workDir = (await sandbox.getWorkDir()) ?? (await sandbox.getUserHomeDir()) ?? "/home/daytona";
  return `${workDir.replace(/\/$/, "")}/app`;
}

// Daytona's filesystem API resolves relative paths from the sandbox WORKDIR,
// while process commands use normal absolute paths inside the sandbox.
export function getProjectFsRoot() {
  return "app";
}

export async function getPreviewHealth(sandbox: Sandbox, port = 3000) {
  const root = await getProjectRoot(sandbox);
  const response = await sandbox.process.executeCommand(
    `status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:${port}/ || true); printf 'COGNIX_HTTP_%s' "$status"`,
    root,
    undefined,
    12,
  );
  const status = response.result.match(/COGNIX_HTTP_(\d{3})/)?.[1] ?? "000";
  return {
    healthy: isHealthyPreviewStatus(Number(status)),
    reachable: status !== "000",
    status,
  };
}

export function isHealthyPreviewStatus(status: number) {
  return status >= 200 && status < 400;
}

async function getVerifiedSignedPreviewUrl(sandbox: Sandbox, port: number) {
  for (let attempt = 0; attempt < PREVIEW_PROXY_VERIFY_ATTEMPTS; attempt += 1) {
    const preview = await sandbox.getSignedPreviewUrl(port, PREVIEW_URL_TTL_SECONDS);
    try {
      const response = await fetch(preview.url, {
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
        headers: { "X-Daytona-Skip-Preview-Warning": "true" },
      });
      await response.body?.cancel();
      if (isHealthyPreviewStatus(response.status)) return preview.url;
    } catch {
      // Daytona's external preview proxy can trail the local port by a few seconds.
    }
    if (attempt < PREVIEW_PROXY_VERIFY_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  return null;
}

export async function getPreviewUrl(project: Project, port = 3000) {
  const sandbox = await getSandbox(project);
  if (!sandbox) return null;
  const health = await getPreviewHealth(sandbox, port);
  if (!health.healthy) return null;
  return getVerifiedSignedPreviewUrl(sandbox, port);
}

export async function ensurePreviewUrl(project: Project, port = 3000) {
  const sandbox = await getSandbox(project);
  if (!sandbox) return null;

  let health = await getPreviewHealth(sandbox, port);
  if (!health.healthy && !health.reachable) {
    const root = await getProjectRoot(sandbox);
    const packageCheck = await sandbox.process.executeCommand("test -f package.json", root, undefined, 10);
    if (packageCheck.exitCode !== 0) return null;

    const dependencyCheck = await sandbox.process.executeCommand(
      "test -d node_modules && if [ -f tsconfig.json ]; then node -e \"require.resolve('typescript/package.json'); require.resolve('@types/node/package.json'); require.resolve('@types/react/package.json'); require.resolve('@types/react-dom/package.json')\"; else true; fi",
      root,
      undefined,
      20,
    );
    if (dependencyCheck.exitCode !== 0) {
      const install = await sandbox.process.executeCommand(
        "npm install --include=dev --no-audit --no-fund",
        root,
        { CI: "1" },
        360,
      );
      if (install.exitCode !== 0) return null;
    }

    const sessionId = `cognix-preview-${project.id.slice(0, 12)}`;
    let hasActiveCommand = false;
    try {
      const session = await sandbox.process.getSession(sessionId);
      hasActiveCommand = session.commands?.some((command) => command.exitCode == null) ?? false;
    } catch {
      await sandbox.process.createSession(sessionId);
    }
    if (!hasActiveCommand) {
      await sandbox.process.executeSessionCommand(
        sessionId,
        {
          command: `cd ${JSON.stringify(root)} && npm run dev -- --hostname 0.0.0.0 --port ${port}`,
          runAsync: true,
          suppressInputEcho: true,
        },
        30,
      );
    }

    await sandbox.process.executeCommand(
      `for i in $(seq 1 60); do status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:${port}/ || true); case "$status" in 2*|3*) exit 0 ;; esac; sleep 2; done; exit 1`,
      root,
      undefined,
      130,
    );
    health = await getPreviewHealth(sandbox, port);
  }

  if (!health.healthy) return null;
  const url = await getVerifiedSignedPreviewUrl(sandbox, port);
  if (url) {
    await updateProject(project.id, project.ownerId, {
      previewUrl: url,
      status: project.status === "published" || project.status === "publishing" ? project.status : "ready",
    }).catch(() => null);
  }
  return url;
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function clonePublishedDependenciesCommand(sourceNodeModules: string, targetNodeModules: string) {
  const source = shellQuote(sourceNodeModules);
  const target = shellQuote(targetNodeModules);
  return [
    `test -d ${source}`,
    `if ! cp -al ${source} ${target}; then rm -rf ${target} && ln -s ${source} ${target}; fi`,
  ].join(" && ");
}

export const publishedBuildLimitsSource = [
  `const os = require("node:os");`,
  `const detectedCpus = os.cpus.bind(os);`,
  `os.cpus = () => detectedCpus().slice(0, 1);`,
  `if (typeof os.availableParallelism === "function") os.availableParallelism = () => 1;`,
  "",
].join("\n");

function publishedPaths(project: Project, root: string) {
  const base = path.posix.join(path.posix.dirname(root), `.cognix-published-${project.id}`);
  return {
    base,
    current: path.posix.join(base, "current"),
    previous: path.posix.join(base, "previous"),
    staging: path.posix.join(base, `staging-${Date.now()}`),
  };
}

function publishedSessionId(project: Project) {
  return `cognix-published-${project.id.slice(0, 12)}`;
}

function developmentSessionIds(project: Project) {
  const suffix = project.id.slice(0, 12);
  return [`cognix-${suffix}`, `cognix-preview-${suffix}`];
}

async function pauseDevelopmentPreview(sandbox: Sandbox, project: Project, root: string) {
  const health = await getPreviewHealth(sandbox, 3000);
  for (const sessionId of developmentSessionIds(project)) {
    await sandbox.process.deleteSession(sessionId).catch(() => undefined);
  }
  if (health.reachable) {
    await sandbox.process.executeCommand(
      "if command -v fuser >/dev/null 2>&1; then fuser -k 3000/tcp >/dev/null 2>&1 || true; fi",
      root,
      undefined,
      20,
    );
  }
  return health.reachable;
}

async function resumeDevelopmentPreview(sandbox: Sandbox, project: Project, root: string) {
  const sessionId = `cognix-preview-${project.id.slice(0, 12)}`;
  await sandbox.process.deleteSession(sessionId).catch(() => undefined);
  await sandbox.process.createSession(sessionId);
  await sandbox.process.executeSessionCommand(
    sessionId,
    {
      command: `cd ${shellQuote(root)} && npm run dev -- --hostname 0.0.0.0 --port 3000`,
      runAsync: true,
      suppressInputEcho: true,
    },
    30,
  );
  await sandbox.process.executeCommand(
    "for i in $(seq 1 60); do status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:3000/ || true); case \"$status\" in 2*|3*) exit 0 ;; esac; sleep 1; done; exit 1",
    root,
    undefined,
    70,
  );
}

async function stopPublishedSession(sandbox: Sandbox, project: Project) {
  await sandbox.process.deleteSession(publishedSessionId(project)).catch(() => undefined);
}

async function startPublishedProcess(sandbox: Sandbox, project: Project, productionRoot: string, command: string) {
  const sessionId = publishedSessionId(project);
  await stopPublishedSession(sandbox, project);
  await sandbox.process.createSession(sessionId);
  const started = await sandbox.process.executeSessionCommand(
    sessionId,
    {
      command: `cd ${shellQuote(productionRoot)} && ${command}`,
      runAsync: true,
      suppressInputEcho: true,
    },
    30,
  );
  const wait = await sandbox.process.executeCommand(
    `for i in $(seq 1 60); do status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:${PUBLISHED_PORT}/ || true); case "$status" in 2*|3*) exit 0 ;; esac; sleep 2; done; exit 1`,
    productionRoot,
    undefined,
    130,
  );
  if (wait.exitCode !== 0) {
    const logs = await sandbox.process.getSessionCommandLogs(sessionId, started.cmdId).catch(() => null);
    const output = [logs?.stdout, logs?.stderr, logs?.output].filter(Boolean).join("\n").slice(-5000);
    throw new Error(`The published server did not become healthy:\n${output || "No server output was captured."}`);
  }
}

async function publishedStartCommand(sandbox: Sandbox, root: string) {
  const packageJson = JSON.parse((await sandbox.fs.downloadFile(`${root}/package.json`)).toString("utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  const scripts = packageJson.scripts ?? {};
  if (scripts.start) {
    const isNext = Boolean(packageJson.dependencies?.next || packageJson.devDependencies?.next);
    return isNext
      ? `PORT=${PUBLISHED_PORT} HOSTNAME=0.0.0.0 npm run start -- --hostname 0.0.0.0 --port ${PUBLISHED_PORT}`
      : `PORT=${PUBLISHED_PORT} HOST=0.0.0.0 npm run start`;
  }
  if (scripts.preview) return `npm run preview -- --host 0.0.0.0 --port ${PUBLISHED_PORT}`;
  throw new Error("The generated app needs a production `start` or `preview` script before it can be published.");
}

async function configurePublishedLifecycle(sandbox: Sandbox) {
  await sandbox.setAutostopInterval(0);
  await sandbox.setAutoArchiveInterval(0);
  await sandbox.setAutoDeleteInterval(-1);
  await sandbox.refreshData();
  if (sandbox.autoStopInterval !== 0) {
    throw new Error("Daytona did not disable auto-stop for the published sandbox.");
  }
  if (sandbox.autoDeleteInterval !== -1) {
    throw new Error("Daytona did not disable auto-delete for the published sandbox.");
  }
}

export async function deployPublishedApp(project: Project) {
  const sandbox = await getSandbox(project);
  if (!sandbox) throw new Error("Build the app before publishing it.");
  const root = await getProjectRoot(sandbox);
  const paths = publishedPaths(project, root);
  const resumePreview = await pauseDevelopmentPreview(sandbox, project, root);
  try {
    const sourcePackage = await sandbox.process.executeCommand("test -f package.json", root, undefined, 10);
    if (sourcePackage.exitCode !== 0) throw new Error("The project is missing package.json.");

    const sourceNodeModules = path.posix.join(root, "node_modules");
    const stagingNodeModules = path.posix.join(paths.staging, "node_modules");
    const prepare = await sandbox.process.executeCommand(
      [
        `mkdir -p ${shellQuote(paths.base)}`,
        `find ${shellQuote(paths.base)} -mindepth 1 -maxdepth 1 -type d -name 'staging-*' -exec rm -rf -- {} +`,
        `mkdir -p ${shellQuote(paths.staging)}`,
        `tar --exclude='./node_modules' --exclude='./.next' --exclude='./.git' -cf - . | tar -xf - -C ${shellQuote(paths.staging)}`,
        clonePublishedDependenciesCommand(sourceNodeModules, stagingNodeModules),
      ].join(" && "),
      root,
      undefined,
      180,
    );
    if (prepare.exitCode !== 0) {
      await sandbox.process.executeCommand(`rm -rf ${shellQuote(paths.staging)}`, root, undefined, 60);
      throw new Error(
        `Could not prepare the production release from the verified workspace dependencies:\n${prepare.result.slice(-5000)}`,
      );
    }

    const buildLimitsPath = path.posix.join(paths.staging, ".cognix-build-limits.cjs");
    await sandbox.fs.uploadFile(Buffer.from(publishedBuildLimitsSource), buildLimitsPath);
    const build = await sandbox.process.executeCommand(
      "npm run build",
      paths.staging,
      {
        CI: "1",
        NEXT_TELEMETRY_DISABLED: "1",
        NODE_OPTIONS: `--max-old-space-size=512 --require=${buildLimitsPath}`,
      },
      600,
    );
    if (build.exitCode !== 0) {
      await sandbox.process.executeCommand(`rm -rf ${shellQuote(paths.staging)}`, root, undefined, 60);
      throw new Error(`The production build failed:\n${build.result.slice(-6000)}`);
    }
    const command = await publishedStartCommand(sandbox, paths.staging);

    const currentCheck = await sandbox.process.executeCommand(
      `test -d ${shellQuote(paths.current)}`,
      root,
      undefined,
      10,
    );
    const hadCurrent = currentCheck.exitCode === 0;
    await stopPublishedSession(sandbox, project);
    const swap = await sandbox.process.executeCommand(
      `rm -rf ${shellQuote(paths.previous)} && ${hadCurrent ? `mv ${shellQuote(paths.current)} ${shellQuote(paths.previous)} && ` : ""}mv ${shellQuote(paths.staging)} ${shellQuote(paths.current)}`,
      root,
      undefined,
      60,
    );
    if (swap.exitCode !== 0) {
      await sandbox.process.executeCommand(`rm -rf ${shellQuote(paths.staging)}`, root, undefined, 60);
      throw new Error(`The production release could not be activated:\n${swap.result.slice(-4000)}`);
    }

    try {
      await startPublishedProcess(sandbox, project, paths.current, command);
    } catch (error) {
      await stopPublishedSession(sandbox, project);
      if (hadCurrent) {
        await sandbox.process.executeCommand(
          `rm -rf ${shellQuote(paths.current)} && mv ${shellQuote(paths.previous)} ${shellQuote(paths.current)}`,
          root,
          undefined,
          60,
        );
        const previousCommand = await publishedStartCommand(sandbox, paths.current);
        await startPublishedProcess(sandbox, project, paths.current, previousCommand).catch(() => undefined);
      }
      throw error;
    }

    await sandbox.process.executeCommand(`rm -rf ${shellQuote(paths.previous)}`, root, undefined, 60);
    await configurePublishedLifecycle(sandbox);
    const runtimeUrl = await getVerifiedSignedPreviewUrl(sandbox, PUBLISHED_PORT);
    if (!runtimeUrl) throw new Error("The production server started, but its public proxy did not become ready.");
    return { runtimeUrl, port: PUBLISHED_PORT };
  } finally {
    if (resumePreview) {
      await resumeDevelopmentPreview(sandbox, project, root).catch(() => undefined);
    }
  }
}

export async function getPublishedAppRuntimeUrl(project: Project) {
  const sandbox = await getSandbox(project);
  if (!sandbox) return null;
  const root = await getProjectRoot(sandbox);
  const current = publishedPaths(project, root).current;
  const exists = await sandbox.process.executeCommand(`test -f ${shellQuote(`${current}/package.json`)}`, root, undefined, 10);
  if (exists.exitCode !== 0) return null;
  let health = await getPreviewHealth(sandbox, PUBLISHED_PORT);
  if (!health.healthy) {
    const command = await publishedStartCommand(sandbox, current);
    await startPublishedProcess(sandbox, project, current, command);
    health = await getPreviewHealth(sandbox, PUBLISHED_PORT);
  }
  if (!health.healthy) return null;
  await configurePublishedLifecycle(sandbox);
  const runtimeUrl = await getVerifiedSignedPreviewUrl(sandbox, PUBLISHED_PORT);
  if (runtimeUrl) {
    await updateProject(project.id, project.ownerId, {
      status: "published",
    }).catch(() => null);
  }
  return runtimeUrl;
}

export async function stopPublishedApp(project: Project) {
  const sandbox = await getSandbox(project);
  if (!sandbox) return;
  await stopPublishedSession(sandbox, project);
  await sandbox.setAutostopInterval(30);
  await sandbox.setAutoArchiveInterval(1440);
  await sandbox.setAutoDeleteInterval(-1);
}
