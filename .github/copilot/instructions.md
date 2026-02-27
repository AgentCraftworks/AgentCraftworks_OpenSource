# GitHub Copilot Instructions — AgentCraftworks CE

> This file is **self-contained** — it includes organization-wide standards so that clones
> and forks of this repo receive the full Copilot instructions without org-level inheritance.

## Project Context

**Project Name**: AgentCraftworks Community Edition (CE)
**Purpose**: Open-source GitHub App for AI agent governance — 5-level engagement model, 4-state handoff FSM, CODEOWNERS routing, MCP tools
**Primary Technologies**: TypeScript (strict), Node.js 22+, Express, esbuild, Azure Container Apps
**Build**: `cd typescript && npm ci && npm run build`
**Test**: `npm -w typescript test`
**Typecheck**: `npm -w typescript run typecheck`

---

<!-- ORG-STANDARD:BEGIN — Synced from https://github.com/AgentCraftworks/.github/blob/main/.github/copilot/instructions.md -->
<!-- Do not edit this section manually. It is updated by the sync-org-standards workflow. -->

## Security-First Authentication

When working with GitHub Actions workflows (`.github/workflows/`):

### NEVER use Personal Access Tokens (PATs)
- Replace any `secrets.*_PAT` with GitHub App Tokens
- Use `actions/create-github-app-token@v1` with `GH_APP_ID` and `GH_APP_PRIVATE_KEY`
- This applies to ALL workflows — no exceptions

### NEVER store Azure credentials as secrets
- Always use OIDC federated credentials for Azure authentication
- Use `azure/login@v2` with `client-id`, `tenant-id`, `subscription-id`
- Include `permissions: id-token: write` in any job that authenticates to Azure

### Token selection by agent tier
- **T1-T2 agents** (read/comment only): Use `secrets.GITHUB_TOKEN` with scoped `permissions:` block
- **T3+ agents** (write operations): Use GitHub App Token via `actions/create-github-app-token@v1`

### Every workflow MUST have
- A `permissions:` block with least-privilege scopes
- An engagement level comment in the header (e.g., `# Engagement Level: T2 (Advisor)`)
- `actions/checkout@v6` (not older versions)
- `environment:` on deploy jobs for protection rules

## Coding Agent Orchestration (4-Tier)

- **Local**: `@code-reviewer` (fast iteration)
- **Dev**: `@code-reviewer`, `@test-specialist`, `@documentation-expert` + specialists
- **Staging**: Core + `@security-specialist` (blocking), `@compliance-auditor` (blocking)
- **Production**: All agents (blocking); requires approvals from `@release-manager`, `@security-auditor`

## Environment Strategy
- Feature branches → CI only (build + test)
- `staging` branch → Deploy to staging Azure environment
- `main` branch → Deploy to production Azure environment
- Infrastructure provisioning → `deploy-azd.yml` (manual trigger with environment selection)

## GitHub API Rate Limits
- Check before heavy operations (>50 calls): `gh api rate_limit`
- Use `git/trees/{sha}?recursive=1` for bulk file reads (1 request vs N)
- If you hit 403: Stop immediately, report reset time, pause

## Coding Conventions
- **Env vars**: `GH_*` prefix (NOT `GITHUB_*` — reserved by GitHub Actions)
- **GitHub API**: Use `octokit.request()`, NOT `.rest.*` methods
- **Types**: Use `unknown` over `any`, strict null checks
- **Logging**: Structured `{ msg, key: value }` pattern
- **Error handling**: Graceful try/catch with structured logging

## Best Practices
- Use **git worktrees** for parallel development (3-5x productivity)
- Switch to **plan mode** when encountering unexpected failures
- Delegate to **subagents** for specialized tasks (security, testing, docs)
- Update **agent instruction files** after every correction (self-learning)

## Always Ask First

Before making significant changes:
- "Should I create a Git branch for this work?"
- "Should I use a git worktree for parallel development?"
- "Do we need security-specialist review for this change?"
- "Which environment (dev/staging/prod) does this target?"
- "Should I update agent instruction files with this lesson?"

<!-- ORG-STANDARD:END -->
