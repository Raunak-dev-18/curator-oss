import { describe, expect, it } from "vitest";
import { publishedAppUrl, publishedFrameUrl, requestOrigin, safeAppPath } from "./publish-url";

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

describe("published app deep links", () => {
  const runtime = "https://3001-abc123.daytonaproxy01.net/";

  it("opens the requested path and query inside the published app", () => {
    expect(publishedFrameUrl(runtime, "/stories/alex?tab=reels")).toBe(
      "https://3001-abc123.daytonaproxy01.net/stories/alex?tab=reels",
    );
    expect(publishedFrameUrl(runtime, "/")).toBe(runtime);
  });

  it("keeps runtime query parameters such as signed tokens", () => {
    expect(publishedFrameUrl("https://runtime.example.net/?token=signed", "/pricing?token=spoofed&plan=pro")).toBe(
      "https://runtime.example.net/pricing?token=signed&plan=pro",
    );
  });

  it("never lets a visitor path change the runtime origin", () => {
    for (const value of ["//evil.example.com/x", "https://evil.example.com", "/\\evil.example.com", "pricing", null]) {
      expect(safeAppPath(value), String(value)).toBe("/");
      expect(new URL(publishedFrameUrl(runtime, value)).origin).toBe("https://3001-abc123.daytonaproxy01.net");
    }
  });
});
