/**
 * GitHub integration tool for interacting with GitHub repositories.
 * Provides read/write access to issues, PRs, files, commits, and projects.
 */

import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import type { AnyAgentTool } from "./common.js";
import { stringEnum } from "../schema/typebox.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";
import * as githubApi from "./github-api.js";

const GITHUB_ACTIONS = [
  "connect",
  "repo_info",
  "list_issues",
  "get_issue",
  "create_issue",
  "list_prs",
  "get_pr",
  "list_files",
  "get_file",
  "list_branches",
  "list_commits",
  "search_code",
  "list_releases",
  "project_list",
] as const;

const STATE_VALUES = ["open", "closed", "all"] as const;

const GitHubToolSchema = Type.Object({
  action: stringEnum(GITHUB_ACTIONS, {
    description: "Action to perform on GitHub",
  }),

  // Repository identification
  repo: Type.Optional(
    Type.String({
      description: "Repository in format 'owner/repo' or full GitHub URL",
    }),
  ),

  // Action-specific parameters
  issue_number: Type.Optional(
    Type.Number({
      description: "Issue number",
    }),
  ),
  pr_number: Type.Optional(
    Type.Number({
      description: "Pull request number",
    }),
  ),
  path: Type.Optional(
    Type.String({
      description: "File or directory path",
    }),
  ),
  branch: Type.Optional(
    Type.String({
      description: "Branch name (default: repository's default branch)",
    }),
  ),
  query: Type.Optional(
    Type.String({
      description: "Search query",
    }),
  ),
  state: Type.Optional(
    stringEnum(STATE_VALUES, {
      description: "Filter by state",
      default: "open",
    }),
  ),
  limit: Type.Optional(
    Type.Number({
      description: "Maximum number of results to return",
      default: 20,
      minimum: 1,
      maximum: 100,
    }),
  ),

  // For create_issue action
  title: Type.Optional(
    Type.String({
      description: "Issue title",
    }),
  ),
  body: Type.Optional(
    Type.String({
      description: "Issue body (markdown)",
    }),
  ),
  labels: Type.Optional(
    Type.Array(Type.String(), {
      description: "Labels to add",
    }),
  ),
});

type GitHubToolParams = {
  action: (typeof GITHUB_ACTIONS)[number];
  repo?: string;
  issue_number?: number;
  pr_number?: number;
  path?: string;
  branch?: string;
  query?: string;
  state?: "open" | "closed" | "all";
  limit?: number;
  title?: string;
  body?: string;
  labels?: string[];
};

// Session state for connected repository
let connectedRepo: githubApi.GitHubRepo | null = null;

/**
 * Get repository context (from connected state or parameter)
 */
function getRepoContext(repoParam?: string): githubApi.GitHubRepo {
  if (repoParam) {
    const parsed = githubApi.parseRepoUrl(repoParam);
    if (!parsed) {
      throw new Error(
        "Invalid repository format. Use 'owner/repo' or 'https://github.com/owner/repo'",
      );
    }
    return parsed;
  }

  if (!connectedRepo) {
    throw new Error(
      "No repository connected. Use action 'connect' with 'repo' parameter first, or provide 'repo' parameter.",
    );
  }

  return connectedRepo;
}

/**
 * Execute GitHub tool action
 */
async function executeGitHubAction(
  params: GitHubToolParams,
  auth?: githubApi.GitHubAuth,
): Promise<Record<string, unknown>> {
  const { action } = params;

  // Handle connect action
  if (action === "connect") {
    if (!params.repo) {
      throw new Error("Repository parameter required for connect action");
    }
    const parsed = githubApi.parseRepoUrl(params.repo);
    if (!parsed) {
      throw new Error(
        "Invalid repository format. Use 'owner/repo' or 'https://github.com/owner/repo'",
      );
    }
    connectedRepo = parsed;

    // Verify repository exists by fetching info
    const info = await githubApi.getRepoInfo(parsed, auth);

    return {
      status: "success",
      action: "connect",
      repo: `${parsed.owner}/${parsed.repo}`,
      data: info,
    };
  }

  // Get repository context for other actions
  const repo = getRepoContext(params.repo);

  // Execute action
  switch (action) {
    case "repo_info": {
      const data = await githubApi.getRepoInfo(repo, auth);
      return {
        status: "success",
        action: "repo_info",
        repo: `${repo.owner}/${repo.repo}`,
        data,
      };
    }

    case "list_issues": {
      const data = await githubApi.listIssues(repo, auth, {
        state: params.state,
        limit: params.limit,
      });
      return {
        status: "success",
        action: "list_issues",
        repo: `${repo.owner}/${repo.repo}`,
        data,
        meta: {
          total: data.length,
          returned: data.length,
          state: params.state ?? "open",
        },
      };
    }

    case "get_issue": {
      if (!params.issue_number) {
        throw new Error("issue_number parameter required");
      }
      const data = await githubApi.getIssue(repo, params.issue_number, auth);
      return {
        status: "success",
        action: "get_issue",
        repo: `${repo.owner}/${repo.repo}`,
        data,
      };
    }

    case "create_issue": {
      if (!params.title) {
        throw new Error("title parameter required");
      }
      if (!auth?.token) {
        throw new Error(
          "GitHub token required for creating issues. Set GITHUB_TOKEN environment variable or configure tools.github.token",
        );
      }
      const data = await githubApi.createIssue(
        repo,
        {
          title: params.title,
          body: params.body,
          labels: params.labels,
        },
        auth,
      );
      return {
        status: "success",
        action: "create_issue",
        repo: `${repo.owner}/${repo.repo}`,
        data,
      };
    }

    case "list_prs": {
      const data = await githubApi.listPullRequests(repo, auth, {
        state: params.state,
        limit: params.limit,
      });
      return {
        status: "success",
        action: "list_prs",
        repo: `${repo.owner}/${repo.repo}`,
        data,
        meta: {
          total: data.length,
          returned: data.length,
          state: params.state ?? "open",
        },
      };
    }

    case "get_pr": {
      if (!params.pr_number) {
        throw new Error("pr_number parameter required");
      }
      const data = await githubApi.getPullRequest(repo, params.pr_number, auth);
      return {
        status: "success",
        action: "get_pr",
        repo: `${repo.owner}/${repo.repo}`,
        data,
      };
    }

    case "list_files": {
      const path = params.path ?? "";
      const data = await githubApi.listFiles(repo, path, auth, params.branch);
      return {
        status: "success",
        action: "list_files",
        repo: `${repo.owner}/${repo.repo}`,
        path,
        data,
        meta: {
          total: data.length,
          returned: data.length,
        },
      };
    }

    case "get_file": {
      if (!params.path) {
        throw new Error("path parameter required");
      }
      const data = await githubApi.getFileContent(repo, params.path, auth, params.branch);
      return {
        status: "success",
        action: "get_file",
        repo: `${repo.owner}/${repo.repo}`,
        data,
      };
    }

    case "list_branches": {
      const data = await githubApi.listBranches(repo, auth, params.limit);
      return {
        status: "success",
        action: "list_branches",
        repo: `${repo.owner}/${repo.repo}`,
        data,
        meta: {
          total: data.length,
          returned: data.length,
        },
      };
    }

    case "list_commits": {
      const data = await githubApi.listCommits(repo, auth, params.limit);
      return {
        status: "success",
        action: "list_commits",
        repo: `${repo.owner}/${repo.repo}`,
        data,
        meta: {
          total: data.length,
          returned: data.length,
        },
      };
    }

    case "search_code": {
      if (!params.query) {
        throw new Error("query parameter required");
      }
      const data = await githubApi.searchCode(repo, params.query, auth, params.limit);
      return {
        status: "success",
        action: "search_code",
        repo: `${repo.owner}/${repo.repo}`,
        query: params.query,
        data,
        meta: {
          totalCount: data.totalCount,
          returned: data.items.length,
        },
      };
    }

    case "list_releases": {
      const data = await githubApi.listReleases(repo, auth, params.limit);
      return {
        status: "success",
        action: "list_releases",
        repo: `${repo.owner}/${repo.repo}`,
        data,
        meta: {
          total: data.length,
          returned: data.length,
        },
      };
    }

    case "project_list": {
      const data = await githubApi.listProjects(repo, auth);
      return {
        status: "success",
        action: "project_list",
        repo: `${repo.owner}/${repo.repo}`,
        data,
        meta: {
          total: data.length,
          returned: data.length,
        },
      };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Create GitHub integration tool
 */
export function createGitHubTool(options?: {
  config?: OpenClawConfig;
  sandboxed?: boolean;
}): AnyAgentTool | null {
  // Check if tool is enabled
  const toolsConfig = options?.config?.tools;
  if (toolsConfig && "github" in toolsConfig && typeof toolsConfig.github === "object") {
    const githubConfig = toolsConfig.github as Record<string, unknown>;
    if ("enabled" in githubConfig && githubConfig.enabled === false) {
      return null;
    }
  }

  // Resolve GitHub token
  const token = githubApi.resolveGitHubToken(options?.config);
  const auth: githubApi.GitHubAuth | undefined = token ? { token, type: "token" } : undefined;

  return {
    label: "GitHub Integration",
    name: "github_project",
    description:
      "Interact with GitHub repositories: read issues, pull requests, files, commits; create issues; search code. Use 'connect' action first to set repository context.",
    parameters: GitHubToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;

      // Parse parameters
      const action = readStringParam(params, "action", {
        required: true,
      }) as (typeof GITHUB_ACTIONS)[number];
      const repo = readStringParam(params, "repo");
      const issue_number = readNumberParam(params, "issue_number", { integer: true });
      const pr_number = readNumberParam(params, "pr_number", { integer: true });
      const path = readStringParam(params, "path");
      const branch = readStringParam(params, "branch");
      const query = readStringParam(params, "query");
      const state = readStringParam(params, "state") as "open" | "closed" | "all" | undefined;
      const limit = readNumberParam(params, "limit", { integer: true });
      const title = readStringParam(params, "title");
      const body = readStringParam(params, "body");
      const labels = params.labels as string[] | undefined;

      try {
        const result = await executeGitHubAction(
          {
            action,
            repo,
            issue_number,
            pr_number,
            path,
            branch,
            query,
            state,
            limit,
            title,
            body,
            labels,
          },
          auth,
        );
        return jsonResult(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return jsonResult({
          status: "error",
          action,
          error: errorMessage,
        });
      }
    },
  };
}
