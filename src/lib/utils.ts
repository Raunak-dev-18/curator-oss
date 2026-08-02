import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function titleFromPrompt(prompt: string) {
  const normalized = prompt
    .replace(/[^a-zA-Z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "Untitled app";

  const words = normalized.split(" ").slice(0, 6);
  const title = words.join(" ");
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function safeFileName(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned.slice(0, 120) || "upload";
}

export function publishSlugFromTitle(title: string) {
  const slug = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug.length >= 3 ? slug : `app-${slug || "site"}`;
}

export function formatRelativeDate(value: string | Date, now: string | Date | number = Date.now()) {
  const date = new Date(value);
  const nowMs = typeof now === "number" ? now : new Date(now).getTime();
  const seconds = Math.round((date.getTime() - nowMs) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  return formatter.format(days, "day");
}
