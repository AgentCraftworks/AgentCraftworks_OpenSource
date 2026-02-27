# AGENTS.md — AgentCraftworks Core (Open Source)

> This file follows the [AGENTS.md](https://agents.md/) open standard.

## Project Overview

AgentCraftworks Core is an open-source **GitHub App** (webhook-driven Express server) that orchestrates multi-agent software development workflows. It uses a 4-state handoff finite state machine, CODEOWNERS-based routing, and the Model Context Protocol (MCP).

**This is NOT a CLI tool.** It is a webhook-driven server that listens for GitHub events and routes work to specialized AI agents.

## Repository Structure

```
AgentCraftworks_OpenSource/
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
└── ArchitecturePatternsPractices/  # Architecture standards
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
- `abandonHandoff` maps to `failed` with `reason="abandoned:..."` (no space after colon)

### Agent Engagement Levels (1-5)

| Level | Name | Action Tier | Permitted Actions |
|-------|------|-------------|-------------------|
| 1 | Observer | T1 | Read, view, list |
| 2 | Advisor | T2 | Comment, suggest |
| 3 | Peer Programmer | T3 | Label, assign, approve, edit file |
| 4 | Agent Team | T4 | Merge, close, create branch, push commit |
| 5 | Full Agent Team | T5 | Deploy, modify CI, orchestrate agents |

## Coding Conventions

- **Runtime**: Node.js 22+ with ES Modules
- **Build**: esbuild for compilation, `tsc --noEmit` for type checking
- **Testing**: `node --import tsx --test test/**/*.test.ts`
- **Types**: Use `unknown` over `any`, strict null checks enabled
- **Logging**: Structured `{ msg, key: value }` pattern
- **Env vars**: `GH_*` prefix (NOT `GITHUB_*` which is reserved by GitHub Actions)
- **GitHub API**: Use `octokit.request()`, NOT `.rest.*` methods

## MCP Server

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
