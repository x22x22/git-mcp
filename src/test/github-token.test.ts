import { describe, it, expect, vi, beforeEach } from "vitest";

describe("GitHub Token Parameter Support", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should extract github_token from URL parameters", () => {
    const url = new URL(
      "https://gitmcp.io/owner/repo?github_token=ghp_test123&sessionId=abc",
    );
    const githubToken = url.searchParams.get("github_token");

    expect(githubToken).toBe("ghp_test123");
    expect(url.searchParams.get("sessionId")).toBe("abc");
  });

  it("should handle URL without github_token", () => {
    const url = new URL("https://gitmcp.io/owner/repo?sessionId=abc");
    const githubToken = url.searchParams.get("github_token");

    expect(githubToken).toBeNull();
  });

  it("should preserve sessionId while removing other params", () => {
    const url = new URL(
      "https://gitmcp.io/owner/repo?github_token=ghp_test&sessionId=abc&other=value",
    );
    const githubToken = url.searchParams.get("github_token");
    const sessionId = url.searchParams.get("sessionId");

    // Extract token before cleaning
    expect(githubToken).toBe("ghp_test");

    // Clean params (simulate what init() does)
    url.searchParams.forEach((_, key) => {
      if (key !== "sessionId") {
        url.searchParams.delete(key);
      }
    });

    // Verify only sessionId remains
    expect(url.searchParams.get("github_token")).toBeNull();
    expect(url.searchParams.get("other")).toBeNull();
    expect(url.searchParams.get("sessionId")).toBe("abc");
  });

  it("should support various token formats", () => {
    const tokenFormats = [
      "ghp_1234567890abcdef", // Classic token
      "github_pat_1234567890", // Fine-grained token
      "gho_1234567890", // OAuth token
    ];

    tokenFormats.forEach((token) => {
      const url = new URL(`https://gitmcp.io/owner/repo?github_token=${token}`);
      const extractedToken = url.searchParams.get("github_token");
      expect(extractedToken).toBe(token);
    });
  });
});
