import { describe, expect, it } from "vitest";
import {
  AGENT_CONTEXT_REFRESH_INTERVAL,
  DEFAULT_AGENT_MAX_TURNS,
  isProductionBuildCommand,
  resolveAgentMaxTurns,
  shouldRefreshAgentContext,
} from "./agent-policy";

describe("agent execution policy", () => {
  it("uses a larger bounded turn budget", () => {
    expect(resolveAgentMaxTurns()).toBe(DEFAULT_AGENT_MAX_TURNS);
    expect(resolveAgentMaxTurns("5")).toBe(20);
    expect(resolveAgentMaxTurns("200")).toBe(120);
    expect(resolveAgentMaxTurns("invalid")).toBe(DEFAULT_AGENT_MAX_TURNS);
  });

  it("refreshes long-running model context at stable intervals", () => {
    expect(shouldRefreshAgentContext(0)).toBe(false);
    expect(shouldRefreshAgentContext(AGENT_CONTEXT_REFRESH_INTERVAL - 1)).toBe(false);
    expect(shouldRefreshAgentContext(AGENT_CONTEXT_REFRESH_INTERVAL)).toBe(true);
  });

  it.each([
    "npm run build",
    "npm build",
    "pnpm build",
    "pnpm run build",
    "yarn build",
    "bun run build",
    "npm run lint && npm run build",
  ])("recognizes production build command: %s", (command) => {
    expect(isProductionBuildCommand(command)).toBe(true);
  });

  it.each(["npm run dev", "npm run lint", "next dev", "echo npm run build"])(
    "does not treat another command as a production build: %s",
    (command) => {
      expect(isProductionBuildCommand(command)).toBe(false);
    },
  );
});
