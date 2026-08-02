export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
]);

export function validateUpload(file: Pick<File, "name" | "size" | "type">) {
  if (!file.name.trim()) return "Choose a file with a valid name.";
  if (file.size <= 0) return "This file is empty. Choose another file.";
  if (file.size > MAX_UPLOAD_BYTES) return "This file is larger than 15 MB. Choose a smaller file.";
  if (!allowedMimeTypes.has(file.type)) {
    return "Use an image, PDF, Markdown, text, or JSON file.";
  }
  return null;
}

