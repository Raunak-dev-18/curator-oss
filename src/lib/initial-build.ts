import type { Message } from "./types";

export function stripInitialBuildParams(href: string) {
  const url = new URL(href);
  url.searchParams.delete("prompt");
  url.searchParams.delete("attachments");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function hasPersistedPrompt(messages: Pick<Message, "role" | "content">[], prompt: string) {
  const normalized = prompt.trim();
  return Boolean(normalized) && messages.some((message) => message.role === "user" && message.content.trim() === normalized);
}
