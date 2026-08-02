import { describe, expect, it } from "vitest";
import { publishSlugFromTitle } from "./utils";

describe("publishSlugFromTitle", () => {
  it("creates a lowercase URL-safe slug", () => {
    expect(publishSlugFromTitle("My Customer Portal!")).toBe("my-customer-portal");
  });

  it("removes edge separators and supplies a useful short fallback", () => {
    expect(publishSlugFromTitle("-- A --")).toBe("app-a");
    expect(publishSlugFromTitle("🔥")).toBe("app-site");
  });

  it("keeps slugs within the publishing limit", () => {
    expect(publishSlugFromTitle("a".repeat(80))).toHaveLength(48);
  });
});
