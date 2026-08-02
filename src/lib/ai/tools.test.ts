import { describe, expect, it } from "vitest";
import { agentTools, applyExactEdit, isPrivateNetworkAddress, projectRelativePath } from "./tools";

describe("agent tool contract", () => {
  it("exposes discovery, editing, terminal, process, preview, and web tools", () => {
    const names = agentTools.map((tool) => tool.function.name);
    expect(names).toEqual(expect.arrayContaining([
      "find_files",
      "search_files",
      "read_file",
      "write_file",
      "edit_file",
      "move_file",
      "delete_file",
      "run_command",
      "get_process_logs",
      "list_processes",
      "stop_process",
      "inspect_preview",
      "web_search",
      "fetch_url",
      "get_preview_url",
    ]));
  });
});

describe("projectRelativePath", () => {
  it("keeps normal project-relative paths unchanged", () => {
    expect(projectRelativePath("/root/app", "package.json")).toBe("package.json");
    expect(projectRelativePath("/root/app", "app/page.tsx")).toBe("app/page.tsx");
  });

  it("removes accidental absolute and slashless project-root prefixes", () => {
    expect(projectRelativePath("/root/app", "/root/app/app/page.tsx")).toBe("app/page.tsx");
    expect(projectRelativePath("/root/app", "root/app/components/feed.tsx")).toBe("components/feed.tsx");
  });

  it("normalizes exact roots, trailing slashes, and dot segments", () => {
    expect(projectRelativePath("/root/app", "/root/app")).toBe("");
    expect(projectRelativePath("/root/app/", "root/app/")).toBe("");
    expect(projectRelativePath("/root/app", "./app/./page.tsx")).toBe("app/page.tsx");
  });

  it("rejects parent-directory traversal even when normalization could hide it", () => {
    expect(() => projectRelativePath("/root/app", "app/../secrets.txt")).toThrow("Path must stay inside the project.");
    expect(() => projectRelativePath("/root/app", "..\\secrets.txt")).toThrow("Path must stay inside the project.");
  });
});

describe("applyExactEdit", () => {
  it("applies one unique surgical edit without interpreting replacement tokens", () => {
    expect(applyExactEdit("const label = 'Old';", "'Old'", "'$& New'")).toEqual({
      content: "const label = '$& New';",
      matches: 1,
    });
  });

  it("requires unique context unless replaceAll is explicit", () => {
    expect(() => applyExactEdit("old old", "old", "new")).toThrow("matched 2 places");
    expect(applyExactEdit("old old", "old", "new", true)).toEqual({ content: "new new", matches: 2 });
  });

  it("rejects stale text instead of overwriting the file", () => {
    expect(() => applyExactEdit("current", "stale", "new")).toThrow("exact text was not found");
  });
});

describe("public web tool network boundaries", () => {
  it("blocks loopback, link-local, and private addresses", () => {
    expect(isPrivateNetworkAddress("127.0.0.1")).toBe(true);
    expect(isPrivateNetworkAddress("169.254.169.254")).toBe(true);
    expect(isPrivateNetworkAddress("10.0.0.8")).toBe(true);
    expect(isPrivateNetworkAddress("172.20.0.1")).toBe(true);
    expect(isPrivateNetworkAddress("192.168.1.2")).toBe(true);
    expect(isPrivateNetworkAddress("::1")).toBe(true);
    expect(isPrivateNetworkAddress("fd00::1")).toBe(true);
  });

  it("permits ordinary public addresses", () => {
    expect(isPrivateNetworkAddress("1.1.1.1")).toBe(false);
    expect(isPrivateNetworkAddress("2606:4700:4700::1111")).toBe(false);
  });
});
