export const DEFAULT_AGENT_MAX_TURNS = 80;
export const AGENT_CONTEXT_REFRESH_INTERVAL = 28;

export function resolveAgentMaxTurns(value = process.env.AGENT_MAX_TURNS) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_AGENT_MAX_TURNS;
  return Math.min(120, Math.max(20, parsed));
}

export function shouldRefreshAgentContext(turn: number) {
  return turn > 0 && turn % AGENT_CONTEXT_REFRESH_INTERVAL === 0;
}

export function isProductionBuildCommand(command: string) {
  return /(?:^|[;&|]\s*)(?:npm\s+(?:run\s+)?build|pnpm\s+(?:run\s+)?build|yarn\s+(?:run\s+)?build|bun\s+run\s+build)(?:\s|$)/i.test(
    command.trim(),
  );
}
