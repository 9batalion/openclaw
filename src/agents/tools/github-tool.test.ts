import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock GitHub API module - must be done before imports
vi.mock("./github-api.js", () => ({
  parseRepoUrl: vi.fn(),
  resolveGitHubToken: vi.fn(),
  getRepoInfo: vi.fn(),
  listIssues: vi.fn(),
  getIssue: vi.fn(),
  createIssue: vi.fn(),
  listPullRequests: vi.fn(),
  getPullRequest: vi.fn(),
  getFileContent: vi.fn(),
  listFiles: vi.fn(),
  listBranches: vi.fn(),
  listCommits: vi.fn(),
  searchCode: vi.fn(),
  listReleases: vi.fn(),
  listProjects: vi.fn(),
}));

import * as githubApi from "./github-api.js";
import { createGitHubTool } from "./github-tool.js";

describe("github tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(githubApi.resolveGitHubToken).mockReturnValue("test-token");
  });

  it("returns null when disabled in config", () => {
    const tool = createGitHubTool({
      config: {
        tools: {
          github: { enabled: false },
        },
      } as never,
    });
    expect(tool).toBeNull();
  });

  it("creates tool when enabled", () => {
    const tool = createGitHubTool();
    expect(tool).toBeTruthy();
    expect(tool?.name).toBe("github_project");
    expect(tool?.label).toBe("GitHub Integration");
  });
});
