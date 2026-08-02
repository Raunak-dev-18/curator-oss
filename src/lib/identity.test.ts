import { describe, expect, it } from "vitest";
import { canonicalAccountId } from "./identity";

describe("canonicalAccountId", () => {
  it("maps verified provider identities with the same email to one account", () => {
    expect(canonicalAccountId("Person@Example.com", true, "auth0|one"))
      .toBe(canonicalAccountId(" person@example.com ", true, "google-oauth2|two"));
  });

  it("does not merge an unverified email identity", () => {
    expect(canonicalAccountId("person@example.com", false, "auth0|unverified")).toBe("auth0|unverified");
  });
});
