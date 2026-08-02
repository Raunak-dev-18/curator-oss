import { describe, expect, it } from "vitest";
import { downloadObject, parseStorageCredentials, storageBucket, uploadObject } from "./storage";

describe("parseStorageCredentials", () => {
  it("accepts a complete service-account credential object", () => {
    expect(parseStorageCredentials(JSON.stringify({ client_email: "builder@example.test", private_key: "private-key" }))).toEqual({
      client_email: "builder@example.test",
      private_key: "private-key",
    });
  });

  it("rejects an email or key ID with an actionable error", () => {
    expect(() => parseStorageCredentials("service-agent@example.test")).toThrow("complete service-account JSON object");
    expect(() => parseStorageCredentials(JSON.stringify({ client_email: "builder@example.test" }))).toThrow(
      "complete service-account JSON object",
    );
  });
});

describe.runIf(!storageBucket)("local upload storage", () => {
  it("round-trips uploads without Google credentials during local development", async () => {
    const key = `test/${crypto.randomUUID()}`;
    const buffer = Buffer.from("preview asset");
    await expect(uploadObject(key, buffer, "text/plain")).resolves.toEqual({ objectKey: key, uri: `memory://${key}` });
    await expect(downloadObject(key)).resolves.toEqual(buffer);
  });
});
