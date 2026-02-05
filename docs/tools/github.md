---
summary: "GitHub integration tool for interacting with repositories, issues, PRs, and code"
read_when:
  - Working with GitHub repositories
  - Managing issues or pull requests
  - Searching code or reading files from GitHub
title: "GitHub Integration"
---

# GitHub Integration (`github_project`)

The `github_project` tool provides comprehensive GitHub integration, allowing the AI agent to interact with repositories, issues, pull requests, files, and more.

## Features

- **Repository operations**: Connect to repositories, get repository information
- **Issues**: List, read, and create issues
- **Pull requests**: List and read pull requests
- **Files**: Browse directories, read file contents
- **Code search**: Search for code patterns across the repository
- **Commits & Branches**: List commits and branches
- **Releases**: List repository releases
- **Projects**: List GitHub Projects

## Configuration

Add to `openclaw.json`:

```json5
{
  tools: {
    github: {
      enabled: true,
      token: "${GITHUB_TOKEN}",  // Or set GITHUB_TOKEN environment variable
    },
  },
}
```

### Configuration Options

- `enabled` (boolean, default: `true`): Enable/disable the GitHub tool
- `token` (string): GitHub Personal Access Token for authentication

## Authentication

The tool supports:

1. **Environment variable**: Set `GITHUB_TOKEN` environment variable
2. **Config file**: Set `tools.github.token` in `openclaw.json`
3. **Public repositories**: Read-only access without authentication

To create a GitHub token:
1. Go to GitHub Settings → Developer Settings → Personal Access Tokens
2. Generate a new token with appropriate permissions:
   - `repo` scope for full repository access
   - `public_repo` scope for public repositories only
3. Copy the token and set it as `GITHUB_TOKEN` environment variable

**Security note**: Never commit tokens to git. Use environment variables or store them securely.

## Usage

### Connect to Repository

First, connect to a repository to set the context:

```json
{
  "action": "connect",
  "repo": "9batalion/openclaw"
}
```

You can use either format:
- `"owner/repo"` - Short format
- `"https://github.com/owner/repo"` - Full URL

Once connected, subsequent operations use this repository context unless you specify a different `repo` parameter.

### Get Repository Information

```json
{
  "action": "repo_info"
}
```

Returns repository details including name, description, stars, forks, language, default branch, and more.

### List Issues

```json
{
  "action": "list_issues",
  "state": "open",     // "open", "closed", or "all"
  "limit": 20          // Maximum results (default: 20)
}
```

### Get Specific Issue

```json
{
  "action": "get_issue",
  "issue_number": 42
}
```

### Create Issue

**Requires authentication with write permissions.**

```json
{
  "action": "create_issue",
  "title": "Bug: Something is broken",
  "body": "## Description\n\nDetails here...",
  "labels": ["bug", "priority:high"]
}
```

### List Pull Requests

```json
{
  "action": "list_prs",
  "state": "open",
  "limit": 10
}
```

### Get Pull Request Details

```json
{
  "action": "get_pr",
  "pr_number": 123
}
```

### List Files in Directory

```json
{
  "action": "list_files",
  "path": "src/agents/tools",   // Optional, defaults to root
  "branch": "main"               // Optional, defaults to default branch
}
```

### Get File Content

```json
{
  "action": "get_file",
  "path": "src/agents/tools/github-tool.ts",
  "branch": "develop"  // Optional
}
```

### Search Code

```json
{
  "action": "search_code",
  "query": "createWebFetchTool",
  "limit": 20
}
```

### List Branches

```json
{
  "action": "list_branches",
  "limit": 30
}
```

### List Commits

```json
{
  "action": "list_commits",
  "limit": 20
}
```

### List Releases

```json
{
  "action": "list_releases",
  "limit": 10
}
```

### List GitHub Projects

```json
{
  "action": "project_list"
}
```

## Return Format

All actions return a consistent JSON structure:

```json
{
  "status": "success",
  "action": "list_issues",
  "repo": "owner/repo",
  "data": [...],
  "meta": {
    "total": 42,
    "returned": 10
  }
}
```

On error:

```json
{
  "status": "error",
  "action": "get_file",
  "error": "GitHub resource not found: file does not exist"
}
```

## Rate Limiting

GitHub API has rate limits:
- **Unauthenticated**: 60 requests/hour per IP
- **Authenticated**: 5,000 requests/hour per token

If you hit the rate limit, the tool will return an error with the wait time:

```
GitHub rate limit exceeded. Wait 15 minutes until 3:45 PM.
```

## Tool Groups

The GitHub tool is part of the `group:github` tool group:

```json5
{
  tools: {
    allow: ["group:github"],  // Enables github_project
  },
}
```

## Examples

**Workflow: Investigate an issue**

1. Connect to repository:
   ```json
   { "action": "connect", "repo": "9batalion/openclaw" }
   ```

2. List recent issues:
   ```json
   { "action": "list_issues", "state": "open", "limit": 5 }
   ```

3. Get details on specific issue:
   ```json
   { "action": "get_issue", "issue_number": 42 }
   ```

4. Search for related code:
   ```json
   { "action": "search_code", "query": "issue-related-function" }
   ```

5. Read relevant files:
   ```json
   { "action": "get_file", "path": "src/problematic-file.ts" }
   ```

**Workflow: Review pull request**

1. Get PR details:
   ```json
   { "action": "get_pr", "pr_number": 123, "repo": "owner/repo" }
   ```

2. List changed files:
   ```json
   { "action": "list_files", "path": "src/changes" }
   ```

3. Read specific files:
   ```json
   { "action": "get_file", "path": "src/changes/new-feature.ts" }
   ```

## Error Handling

Common errors and solutions:

### Authentication Required

```
GitHub authentication failed. Please set GITHUB_TOKEN environment variable or configure tools.github.token.
```

**Solution**: Set up authentication as described above.

### Repository Not Found

```
GitHub resource not found: repository does not exist or is private
```

**Solution**: 
- Verify the repository name/URL
- Ensure you have access to the repository
- For private repos, ensure your token has `repo` scope

### Rate Limit Exceeded

```
GitHub rate limit exceeded. Wait 15 minutes until 3:45 PM.
```

**Solution**: Wait for the rate limit to reset, or use authentication to increase limits.

### File Not Found

```
GitHub resource not found: file does not exist
```

**Solution**: 
- Verify the file path
- Check the branch name
- Ensure the file exists in the repository

## See Also

- [Tool Policy](/tools#disabling-tools) - Control which tools are available
- [Tool Groups](/tools#tool-profiles-base-allowlist) - Using `group:github`
- [GitHub REST API Documentation](https://docs.github.com/en/rest)
