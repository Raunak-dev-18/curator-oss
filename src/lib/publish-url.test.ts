import { describe, expect, it } from "vitest";
import { publishedAppUrl, requestOrigin } from "./publish-url";

describe("publishing URL construction", () => {
  it("uses the current localhost origin during local development", () => {
    const request = new Request("http://localhost:3000/api/projects/project-1/publish");
    expect(requestOrigin(request)).toBe("http://localhost:3000");
    expect(publishedAppUrl(request, "notes-app")).toBe("http://localhost:3000/publish/notes-app");
  });

  it("uses the public forwarded domain behind a deployment proxy", () => {
    const request = new Request("http://internal:3000/api/projects/project-1/publish", {
      headers: {
        "x-forwarded-host": "cognix.example.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(publishedAppUrl(request, "notes-app")).toBe("https://cognix.example.com/publish/notes-app");
  });

  it("uses only the first proxy value", () => {
    const request = new Request("http://internal:3000/api", {
      headers: {
        "x-forwarded-host": "apps.example.com, internal:3000",
        "x-forwarded-proto": "https, http",
      },
    });
    expect(requestOrigin(request)).toBe("https://apps.example.com");
  });
});
