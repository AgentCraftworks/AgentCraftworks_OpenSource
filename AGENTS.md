# AGENTS.md — AgentCraftworks Core (Open Source)

> This file follows the [AGENTS.md](https://agents.md/) open standard (Linux Foundation / Agentic AI Foundation).
> It is read by 25+ coding agent tools including Claude Code, GitHub Copilot, Gemini CLI, Cursor, Windsurf, Devin, OpenAI Codex, and more.
>
> This file is **self-contained** — it includes organization-wide standards so that clones
> and forks of this repo receive the full agent instructions without needing org-level inheritance.

---

## Project Overview

AgentCraftworks Core is an open-source **GitHub App** (webhook-driven Express server) that orchestrates multi-agent software development workflows. It uses a 4-state handoff finite state machine, CODEOWNERS-based routing, and the Model Context Protocol (MCP).

**This is NOT a CLI tool.** It is a webhook-driven server that listens for GitHub events and routes work to specialized AI agents.

## Repository Structure

```
AgentCraftworks-CE/
├── typescript/
│   ├── src/          # Source code
│   │   ├── types/    # TypeScript type definitions
│   │   ├── utils/    # Core utilities (FSM, CODEOWNERS, auth)
│   │   ├── services/ # Business logic (handoffs, classification, autonomy)
│   │   ├── middleware/ # Express middleware (webhook sig, permissions)
│   │   ├── handlers/  # Route handlers (PR, handoff API, autonomy)
│   │   ├── mcp/      # MCP server with 6 tools
│   │   └── index.ts  # Entry point
│   ├── test/         # Tests (node:test + tsx)
│   ├── tsconfig.json # strict: true
│   └── package.json  # @agentcraftworks/core
├── infra/            # Azure Bicep infrastructure-as-code
├── scripts/          # Deployment and utility scripts
└── docs/             # Documentation
```

## Building and Testing

```bash
cd typescript && npm install
npm run typecheck      # tsc --noEmit
npm run build          # esbuild compilation
node --import tsx --test test/**/*.test.ts
```

## Core Domain Concepts

### Handoff State Machine

```
pending → active → completed
  ↓         ↓
failed    failed
```

- 4 states, 2 terminal (`completed`, `failed`)
- `failed` uses reason prefixes: `rejected:*`, `abandoned:*`, `error:*`, `timeout:*`
- `overdue` is a **computed property** (not a stored state)
- Handoff IDs are UUIDs
- `abandonHandoff` maps to `failed` with `reason="abandoned:..."` (no space after colon)

### MCP Server

The TypeScript implementation exposes an MCP (Model Context Protocol) server with 6 tools:

| Tool | Description |
|------|-------------|
| `create_handoff` | Create a new agent handoff |
| `accept_handoff` | Accept a pending handoff |
| `complete_handoff` | Mark a handoff as completed |
| `query_workflow_state` | Query handoff state and history |
| `attach_context` | Attach structured context to a handoff |
| `get_context` | Retrieve context for a handoff |

## Key Gotchas

1. Sub-millisecond timing in tests: add small delays (`setTimeout(r, 10)`) when comparing timestamps
2. `abandonHandoff` format: `abandoned:reason` (no space after colon)
3. TypeScript `dist/` is gitignored — only source is committed

---

<!-- ORG-STANDARD:BEGIN — Synced from https://github.com/AgentCraftworks/.github/blob/main/AGENTS.md -->
<!-- Do not edit this section manually. It is updated by the sync-org-standards workflow. -->

## Security Requirements for Workflows & Authentication

> **MANDATORY — all agents must follow these rules when creating or modifying GitHub Actions workflows, authentication, or infrastructure code.**

### Authentication Hierarchy (most secure → least)

| Priority | Method | Use Case | Required |
|----------|--------|----------|----------|
| 1 | **OIDC Federated Credentials** | Azure login in GitHub Actions | ✅ Always |
| 2 | **GitHub App Token** (`actions/create-github-app-token@v1`) | T3+ agent workflows that write (branches, commits, PRs) | ✅ For T3+ |
| 3 | **`GITHUB_TOKEN`** (automatic) | T1-T2 agent workflows (read, comment) | ✅ For T1-T2 |

### Prohibited Practices

- ❌ **Never use Personal Access Tokens (PATs)** — use GitHub App Tokens instead
- ❌ **Never store Azure credentials as secrets** — use OIDC federated credentials (`id-token: write`)
- ❌ **Never use `secrets.GITHUB_TOKEN` for T3+ agents** — use `actions/create-github-app-token` instead (commits from `GITHUB_TOKEN` don't trigger downstream workflows)
- ❌ **Never create workflows without a `permissions:` block** — always declare least-privilege permissions
- ❌ **Never hardcode secrets, tokens, or credentials** in workflow files or source code
- ❌ **Never commit `.env` files** — use `.env.example` templates only

### GitHub App Token Pattern (required for T3+ agents)

```yaml
steps:
  - name: Generate GitHub App Token
    id: app-token
    uses: actions/create-github-app-token@v1
    with:
      app-id: ${{ secrets.GH_APP_ID }}
      private-key: ${{ secrets.GH_APP_PRIVATE_KEY }}

  - name: Checkout with App Token
    uses: actions/checkout@v6
    with:
      token: ${{ steps.app-token.outputs.token }}

  - name: Run agent job
    env:
      GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
    run: npx tsx src/jobs/your-job.ts
```

### Azure OIDC Pattern (required for all Azure deployments)

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - name: Azure Login (OIDC)
    uses: azure/login@v2
    with:
      client-id: ${{ secrets.AZURE_CLIENT_ID }}
      tenant-id: ${{ secrets.AZURE_TENANT_ID }}
      subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

### Workflow Requirements Checklist

When creating or modifying any `.github/workflows/*.yml` file:

- [ ] `permissions:` block is present with least-privilege scopes
- [ ] No PATs — use GitHub App Token or `GITHUB_TOKEN`
- [ ] Azure auth uses OIDC (no `AZURE_CREDENTIALS` secret)
- [ ] Deploy workflows specify `environment:` for protection rules
- [ ] `actions/checkout` uses `@v6` (not older versions)
- [ ] Agent engagement level (T1-T5) is documented in workflow header comment

### Security Guidelines

- **HMAC Verification**: All webhooks must be HMAC-SHA256 verified before processing
- **Managed Identities**: Use managed identity when deployed to Azure (no stored credentials)
- **Correlation IDs**: All logs must include correlation ID for tracing across Azure Monitor
- **Never commit secrets**: Use `.env` file (not in git) or environment-scoped secrets in CI/CD

## Agent Engagement Levels (1-5)

Graduated permission control for AI agents:

| Level | Name | Action Tier | Permitted Actions |
|-------|------|-------------|-------------------|
| 1 | Observer | T1 | Read, view, list |
| 2 | Advisor | T2 | Comment, suggest |
| 3 | Peer Programmer | T3 | Label, assign, approve, edit file |
| 4 | Agent Team | T4 | Merge, close, create branch, push commit |
| 5 | Full Agent Team | T5 | Deploy, modify CI, orchestrate agents |

### Environment Caps

| Environment | Max Level | Max Name |
|------------|-----------|----------|
| local | 5 | Full Agent Team |
| dev | 5 | Full Agent Team |
| staging | 4 | Agent Team |
| production | 3 | Peer Programmer |

## Coding Agent Orchestration (4-Tier)

- **Local**: `@code-reviewer` (fast iteration)
- **Dev**: `@code-reviewer`, `@test-specialist`, `@documentation-expert` + specialists
- **Staging**: Core + `@security-specialist` (blocking), `@compliance-auditor` (blocking), `@performance-optimizer`, `@refactoring-expert`
- **Production**: All agents (blocking); requires approvals from `@release-manager`, `@security-auditor`, `@compliance-auditor`; deployment monitoring by `@production-observer`

### Environment Strategy for CI/CD

- Feature branches → CI only (build + test)
- `staging` branch → Deploy to staging Azure environment
- `main` branch → Deploy to production Azure environment
- Infrastructure provisioning → `deploy-azd.yml` (manual trigger with environment selection)

## Architecture Patterns & Practices

**Before implementing ANY pattern covered by a standard, you MUST read the relevant document in `ArchitecturePatternsPractices/` (if present in the repo).** These are **LOCKED** standards. Do not deviate without creating an Architecture Decision Record (ADR).

### Rules

1. **Read before writing**: Each standard documents anti-patterns. Do NOT repeat them.
2. **Verification checklists**: Each standard has one. Validate your implementation before submitting.
3. **ADR for deviations**: To deviate from a LOCKED standard, create an ADR using the template.
4. **New standards**: Use the `TEMPLATE.md` for new standard proposals.

## GitHub API Rate Limit Management

**The authenticated GitHub API has a 5,000 request/hour limit per user token.**

### Rate limit rules for agents

1. **Check before heavy operations** (>50 API calls):
   ```bash
   gh api rate_limit --jq '.resources.core | "\(.remaining)/\(.limit) remaining, resets \(.reset | todate)"'
   ```
2. **Batch reads via Trees API**: Use `git/trees/{sha}?recursive=1` (1 request) instead of `contents/{path}` per file.
3. **Cache SHAs across operations**: If you read a file's SHA in one step, reuse it.
4. **Pace bulk writes**: For >10 writes, use the Git Data API to create a single commit with multiple file changes.
5. **If you hit 403 rate limit**: Stop immediately. Check `gh api rate_limit` for reset time. Report to the user and pause.

## Best Practices for AI-Assisted Development

### 1. Git Worktrees for Parallel Development

Use git worktrees to run 3-5 parallel agent sessions:
```bash
git worktree add ../MyRepo-security feature/security-hardening
git worktree add ../MyRepo-docs feature/documentation-update
```
**Benefits**: 3-5x productivity, zero context switching, independent environments.

### 2. Plan Mode for Verification

Switch to plan mode when things go sideways: unexpected test failures, build errors, cascading fixes, unclear requirements.

### 3. Subagent Orchestration

Delegate to specialized subagents to keep context clean.

### 4. Voice Dictation

Speak prompts (3x faster than typing): macOS Fn×2, Windows Win+H.

### 5. Self-Learning Rules

After every correction, update agent instruction files so agents don't repeat mistakes.

## Coding Conventions

- **Runtime**: Node.js 22+ with ES Modules
- **Build**: esbuild for compilation, `tsc --noEmit` for type checking
- **Testing**: `node --import tsx --test test/**/*.test.ts`
- **Types**: Use `unknown` over `any`, strict null checks enabled
- **Logging**: Structured `{ msg, key: value }` pattern
- **Env vars**: `GH_*` prefix (NOT `GITHUB_*` which is reserved by GitHub Actions)
- **GitHub API**: Use `octokit.request()`, NOT `.rest.*` methods
- **Error Handling**: Graceful try/catch; structured error logging with context
- **Comments**: Explain "why", not "what"; use JSDoc for public functions

## Contributing Standards

1. Create feature branch: `feat/*` or `feature/*`
2. Use git worktrees for parallel development (see best practices)
3. Open PR with agent labels for review routing
4. Address feedback from assigned agents
5. Update agent instruction files if you discover new lessons
6. Merge after approval and CI passes
7. Delete feature branch and worktree

## Always Ask First

Before making significant changes:
- "Should I create a Git branch for this work?"
- "Should I use a git worktree for parallel development?"
- "Do we need security-specialist review for this change?"
- "Which environment (dev/staging/prod) does this target?"
- "Should I update deployment or status documentation?"
- "Should I update agent instruction files with this lesson?"

<!-- ORG-STANDARD:END -->
