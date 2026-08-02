import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, validateUpload } from "./upload-policy";

describe("validateUpload", () => {
  it("accepts supported image input", () => {
    expect(validateUpload({ name: "reference.png", type: "image/png", size: 1024 })).toBeNull();
  });

  it("rejects oversized uploads with a recovery message", () => {
    expect(
      validateUpload({ name: "large.png", type: "image/png", size: MAX_UPLOAD_BYTES + 1 }),
    ).toContain("15 MB");
  });

  it("rejects executable input", () => {
    expect(validateUpload({ name: "script.exe", type: "application/x-msdownload", size: 1024 })).toContain(
      "image, PDF, Markdown, text, or JSON",
    );
  });
});

