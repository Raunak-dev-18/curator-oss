import type { Sandbox } from "@daytona/sdk";
import { describe, expect, it } from "vitest";
import {
  clonePublishedDependenciesCommand,
  getPreviewHealth,
  isHealthyPreviewStatus,
  publishedBuildLimitsSource,
} from "./daytona";

function sandboxReturning(result: string) {
  return {
    getWorkDir: async () => "/root",
    process: {
      executeCommand: async () => ({ exitCode: 0, result }),
    },
  } as unknown as Sandbox;
}

describe("getPreviewHealth", () => {
  it.each(["200", "204", "301"])("accepts HTTP %s as preview-ready", async (status) => {
    await expect(getPreviewHealth(sandboxReturning(`COGNIX_HTTP_${status}`))).resolves.toEqual({
      healthy: true,
      reachable: true,
      status,
    });
  });

  it.each(["404", "500"])("rejects reachable HTTP %s responses", async (status) => {
    await expect(getPreviewHealth(sandboxReturning(`COGNIX_HTTP_${status}`))).resolves.toEqual({
      healthy: false,
      reachable: true,
      status,
    });
  });

  it("distinguishes a closed port from an HTTP error", async () => {
    await expect(getPreviewHealth(sandboxReturning("curl failed\nCOGNIX_HTTP_000"))).resolves.toEqual({
      healthy: false,
      reachable: false,
      status: "000",
    });
  });
});

describe("isHealthyPreviewStatus", () => {
  it("accepts successful responses and redirects but rejects proxy failures", () => {
    expect(isHealthyPreviewStatus(200)).toBe(true);
    expect(isHealthyPreviewStatus(307)).toBe(true);
    expect(isHealthyPreviewStatus(404)).toBe(false);
    expect(isHealthyPreviewStatus(502)).toBe(false);
  });
});

describe("published dependency snapshots", () => {
  it("reuses the verified workspace dependency tree without a second package install", () => {
    const command = clonePublishedDependenciesCommand("/root/app/node_modules", "/root/release/node_modules");
    expect(command).toContain("cp -al");
    expect(command).toContain("ln -s");
    expect(command).not.toContain("npm install");
    expect(command).not.toContain("npm ci");
  });

  it("limits Next.js build worker discovery inside small sandboxes", () => {
    expect(publishedBuildLimitsSource).toContain("slice(0, 1)");
    expect(publishedBuildLimitsSource).toContain("availableParallelism = () => 1");
  });
});
