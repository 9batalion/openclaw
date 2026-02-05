/**
 * GitHub API client wrapper for interacting with GitHub REST API v3.
 * Handles authentication, rate limiting, and common API operations.
 */

import type { OpenClawConfig } from "../../config/config.js";

const GITHUB_API_BASE = "https://api.github.com";
const DEFAULT_PER_PAGE = 30;
const MAX_PER_PAGE = 100;

export type GitHubAuth = {
  token?: string;
  type?: "token" | "app";
};

export type GitHubRepo = {
  owner: string;
  repo: string;
};

type GitHubFetchOptions = {
  auth?: GitHubAuth;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  perPage?: number;
  page?: number;
};

/**
 * Parse repository from various formats:
 * - "owner/repo"
 * - "https://github.com/owner/repo"
 * - "https://github.com/owner/repo.git"
 */
export function parseRepoUrl(input: string): GitHubRepo | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  // Try direct owner/repo format
  const directMatch = /^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9._-]+)$/.exec(trimmed);
  if (directMatch) {
    return {
      owner: directMatch[1],
      repo: directMatch[2],
    };
  }

  // Try URL format
  try {
    const url = new URL(trimmed);
    if (url.hostname !== "github.com") {
      return null;
    }
    const pathMatch = /^\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9._-]+?)(?:\.git)?$/.exec(url.pathname);
    if (pathMatch) {
      return {
        owner: pathMatch[1],
        repo: pathMatch[2],
      };
    }
  } catch {
    // Not a valid URL, ignore
  }

  return null;
}

/**
 * Resolve GitHub token from config or environment variable
 */
export function resolveGitHubToken(config?: OpenClawConfig): string | undefined {
  const toolsConfig = config?.tools;
  if (toolsConfig && "github" in toolsConfig && typeof toolsConfig.github === "object") {
    const githubConfig = toolsConfig.github as Record<string, unknown>;
    if ("token" in githubConfig && typeof githubConfig.token === "string") {
      const token = githubConfig.token.trim();
      if (token && token !== "${GITHUB_TOKEN}") {
        return token;
      }
    }
  }

  const envToken = process.env.GITHUB_TOKEN?.trim();
  return envToken || undefined;
}

/**
 * Make a GitHub API request
 */
async function githubFetch(
  path: string,
  options: GitHubFetchOptions = {},
): Promise<{ data: unknown; headers: Headers }> {
  const url = new URL(path, GITHUB_API_BASE);

  // Add pagination params
  if (options.perPage) {
    url.searchParams.set("per_page", String(Math.min(options.perPage, MAX_PER_PAGE)));
  }
  if (options.page) {
    url.searchParams.set("page", String(options.page));
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "OpenClaw-GitHub-Tool",
    ...options.headers,
  };

  // Add auth header
  if (options.auth?.token) {
    headers.Authorization = `Bearer ${options.auth.token}`;
  }

  const res = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Handle rate limiting
  if (res.status === 403) {
    const rateLimitRemaining = res.headers.get("x-ratelimit-remaining");
    const rateLimitReset = res.headers.get("x-ratelimit-reset");
    if (rateLimitRemaining === "0" && rateLimitReset) {
      const resetTime = new Date(Number.parseInt(rateLimitReset) * 1000);
      const waitMinutes = Math.ceil((resetTime.getTime() - Date.now()) / 60000);
      throw new Error(
        `GitHub rate limit exceeded. Wait ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"} until ${resetTime.toLocaleTimeString()}.`,
      );
    }
  }

  if (!res.ok) {
    const errorBody = await res.text();
    let errorMessage: string;
    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage = errorJson.message || res.statusText;
    } catch {
      errorMessage = res.statusText;
    }

    if (res.status === 404) {
      throw new Error(`GitHub resource not found: ${errorMessage}`);
    }
    if (res.status === 401) {
      throw new Error(
        "GitHub authentication failed. Please set GITHUB_TOKEN environment variable or configure tools.github.token.",
      );
    }

    throw new Error(`GitHub API error (${res.status}): ${errorMessage}`);
  }

  const data = await res.json();
  return { data, headers: res.headers };
}

/**
 * Get repository information
 */
export async function getRepoInfo(repo: GitHubRepo, auth?: GitHubAuth) {
  const { data } = await githubFetch(`/repos/${repo.owner}/${repo.repo}`, { auth });
  const r = data as Record<string, unknown>;
  return {
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    stars: r.stargazers_count,
    forks: r.forks_count,
    language: r.language,
    defaultBranch: r.default_branch,
    visibility: r.visibility,
    url: r.html_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * List repository issues
 */
export async function listIssues(
  repo: GitHubRepo,
  auth?: GitHubAuth,
  params?: { state?: "open" | "closed" | "all"; limit?: number },
) {
  const state = params?.state ?? "open";
  const limit = params?.limit ?? DEFAULT_PER_PAGE;

  const { data } = await githubFetch(`/repos/${repo.owner}/${repo.repo}/issues?state=${state}`, {
    auth,
    perPage: limit,
  });

  const issues = data as Array<Record<string, unknown>>;
  return issues
    .filter((issue) => !issue.pull_request) // Exclude PRs
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      author: (issue.user as Record<string, unknown>)?.login,
      labels: (issue.labels as Array<Record<string, unknown>>)?.map((l) => l.name) ?? [],
      createdAt: issue.created_at,
      commentsCount: issue.comments,
      url: issue.html_url,
    }));
}

/**
 * Get specific issue details
 */
export async function getIssue(repo: GitHubRepo, issueNumber: number, auth?: GitHubAuth) {
  const { data } = await githubFetch(`/repos/${repo.owner}/${repo.repo}/issues/${issueNumber}`, {
    auth,
  });
  const issue = data as Record<string, unknown>;
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    body: issue.body,
    author: (issue.user as Record<string, unknown>)?.login,
    labels: (issue.labels as Array<Record<string, unknown>>)?.map((l) => l.name) ?? [],
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    commentsCount: issue.comments,
    url: issue.html_url,
  };
}

/**
 * Create a new issue
 */
export async function createIssue(
  repo: GitHubRepo,
  params: { title: string; body?: string; labels?: string[] },
  auth?: GitHubAuth,
) {
  const { data } = await githubFetch(`/repos/${repo.owner}/${repo.repo}/issues`, {
    auth,
    method: "POST",
    body: params,
  });
  const issue = data as Record<string, unknown>;
  return {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
  };
}

/**
 * List pull requests
 */
export async function listPullRequests(
  repo: GitHubRepo,
  auth?: GitHubAuth,
  params?: { state?: "open" | "closed" | "all"; limit?: number },
) {
  const state = params?.state ?? "open";
  const limit = params?.limit ?? DEFAULT_PER_PAGE;

  const { data } = await githubFetch(`/repos/${repo.owner}/${repo.repo}/pulls?state=${state}`, {
    auth,
    perPage: limit,
  });

  const prs = data as Array<Record<string, unknown>>;
  return prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    author: (pr.user as Record<string, unknown>)?.login,
    createdAt: pr.created_at,
    url: pr.html_url,
  }));
}

/**
 * Get specific pull request details
 */
export async function getPullRequest(repo: GitHubRepo, prNumber: number, auth?: GitHubAuth) {
  const { data } = await githubFetch(`/repos/${repo.owner}/${repo.repo}/pulls/${prNumber}`, {
    auth,
  });
  const pr = data as Record<string, unknown>;
  return {
    number: pr.number,
    title: pr.title,
    state: pr.state,
    body: pr.body,
    author: (pr.user as Record<string, unknown>)?.login,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    url: pr.html_url,
    head: (pr.head as Record<string, unknown>)?.ref,
    base: (pr.base as Record<string, unknown>)?.ref,
  };
}

/**
 * Get file content from repository
 */
export async function getFileContent(
  repo: GitHubRepo,
  path: string,
  auth?: GitHubAuth,
  branch?: string,
) {
  const url = `/repos/${repo.owner}/${repo.repo}/contents/${path}${branch ? `?ref=${branch}` : ""}`;
  const { data } = await githubFetch(url, { auth });
  const file = data as Record<string, unknown>;

  if (file.type !== "file") {
    throw new Error(`Path is not a file: ${path}`);
  }

  // Decode base64 content
  const content = Buffer.from(file.content as string, "base64").toString("utf-8");

  return {
    path: file.path,
    content,
    size: file.size,
    sha: file.sha,
    url: file.html_url,
  };
}

/**
 * List files in directory
 */
export async function listFiles(
  repo: GitHubRepo,
  path: string,
  auth?: GitHubAuth,
  branch?: string,
) {
  const url = `/repos/${repo.owner}/${repo.repo}/contents/${path || ""}${branch ? `?ref=${branch}` : ""}`;
  const { data } = await githubFetch(url, { auth });
  const entries = data as Array<Record<string, unknown>>;

  return entries.map((entry) => ({
    name: entry.name,
    path: entry.path,
    type: entry.type,
    size: entry.size,
    sha: entry.sha,
    url: entry.html_url,
  }));
}

/**
 * List branches
 */
export async function listBranches(repo: GitHubRepo, auth?: GitHubAuth, limit?: number) {
  const { data } = await githubFetch(`/repos/${repo.owner}/${repo.repo}/branches`, {
    auth,
    perPage: limit ?? DEFAULT_PER_PAGE,
  });
  const branches = data as Array<Record<string, unknown>>;
  return branches.map((branch) => ({
    name: branch.name,
    sha: (branch.commit as Record<string, unknown>)?.sha,
    protected: branch.protected,
  }));
}

/**
 * List recent commits
 */
export async function listCommits(repo: GitHubRepo, auth?: GitHubAuth, limit?: number) {
  const { data } = await githubFetch(`/repos/${repo.owner}/${repo.repo}/commits`, {
    auth,
    perPage: limit ?? DEFAULT_PER_PAGE,
  });
  const commits = data as Array<Record<string, unknown>>;
  return commits.map((commit) => {
    const c = commit.commit as Record<string, unknown>;
    const author = c.author as Record<string, unknown>;
    return {
      sha: commit.sha,
      message: c.message,
      author: author?.name,
      date: author?.date,
      url: commit.html_url,
    };
  });
}

/**
 * Search code in repository
 */
export async function searchCode(
  repo: GitHubRepo,
  query: string,
  auth?: GitHubAuth,
  limit?: number,
) {
  const searchQuery = `${query} repo:${repo.owner}/${repo.repo}`;
  const { data } = await githubFetch(`/search/code?q=${encodeURIComponent(searchQuery)}`, {
    auth,
    perPage: limit ?? DEFAULT_PER_PAGE,
  });
  const result = data as Record<string, unknown>;
  const items = (result.items as Array<Record<string, unknown>>) ?? [];

  return {
    totalCount: result.total_count,
    items: items.map((item) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      url: item.html_url,
    })),
  };
}

/**
 * List releases
 */
export async function listReleases(repo: GitHubRepo, auth?: GitHubAuth, limit?: number) {
  const { data } = await githubFetch(`/repos/${repo.owner}/${repo.repo}/releases`, {
    auth,
    perPage: limit ?? DEFAULT_PER_PAGE,
  });
  const releases = data as Array<Record<string, unknown>>;
  return releases.map((release) => ({
    id: release.id,
    tagName: release.tag_name,
    name: release.name,
    draft: release.draft,
    prerelease: release.prerelease,
    createdAt: release.created_at,
    publishedAt: release.published_at,
    url: release.html_url,
  }));
}

/**
 * List GitHub Projects (v2)
 */
export async function listProjects(repo: GitHubRepo, auth?: GitHubAuth) {
  // Note: Projects v2 API requires GraphQL, simplified here
  const { data } = await githubFetch(`/repos/${repo.owner}/${repo.repo}/projects`, {
    auth,
    headers: { Accept: "application/vnd.github.inertia-preview+json" },
  });
  const projects = data as Array<Record<string, unknown>>;
  return projects.map((project) => ({
    id: project.id,
    number: project.number,
    name: project.name,
    body: project.body,
    state: project.state,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  }));
}
