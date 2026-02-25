# AgentCraftworks Core

> Open-source framework for orchestrating multi-agent software development workflows using GitHub webhooks and the Model Context Protocol (MCP).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)

## What is AgentCraftworks?

AgentCraftworks is a **webhook-driven Express server** that automates software development workflows using intelligent AI agents. It listens for GitHub events (PR opened, review requested, etc.) and routes work to specialized AI agents via CODEOWNERS-based routing.

**This is NOT a CLI tool.** It is a GitHub App backend that orchestrates agent handoffs through a finite state machine.

### Key Features

- **4-State Handoff FSM**: `pending → active → completed` (with `failed` from any non-terminal state)
- **CODEOWNERS-Based Routing**: Automatically routes work to the right agent based on file paths
- **Engagement Level Governance**: 5-tier permission system (Observer → Full Agent Team)
- **MCP Server**: 6 tools for agent orchestration via Model Context Protocol
- **Action Classification**: T1-T5 tier system mapping actions to required engagement levels
- **Webhook Signature Verification**: Secure GitHub webhook processing with HMAC-SHA256

## Quick Start

### Prerequisites

- Node.js 22+
- npm 10+

### Installation

```bash
cd typescript
npm install
```

### Build & Type Check

```bash
npm run build          # esbuild compilation (~50ms)
npm run typecheck      # tsc --noEmit (strict mode)
```

### Run Tests

```bash
node --import tsx --test test/**/*.test.ts
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GH_APP_ID` | Yes | GitHub App ID |
| `GH_PRIVATE_KEY` | Yes | GitHub App private key (PEM) |
| `GH_WEBHOOK_SECRET` | Yes | Webhook signature verification secret |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (`local`, `dev`, `staging`, `production`) |

> **Note:** Use `GH_*` prefix, NOT `GITHUB_*` (reserved by GitHub Actions).

## Architecture

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

### Agent Engagement Levels (1-5)

| Level | Name | Action Tier | Permitted Actions |
|-------|------|-------------|-------------------|
| 1 | Observer | T1 | Read, view, list |
| 2 | Advisor | T2 | Comment, suggest |
| 3 | Peer Programmer | T3 | Label, assign, approve, edit file |
| 4 | Agent Team | T4 | Merge, close, create branch, push commit |
| 5 | Full Agent Team | T5 | Deploy, modify CI, orchestrate agents |

### Environment Caps

| Environment | Max Level |
|-------------|-----------|
| local / dev | 5 (Full Agent Team) |
| staging | 4 (Agent Team) |
| production | 3 (Peer Programmer) |

## MCP Server

The MCP server exposes 6 tools for agent orchestration:

| Tool | Description |
|------|-------------|
| `create_handoff` | Create a new agent handoff |
| `accept_handoff` | Accept a pending handoff |
| `complete_handoff` | Mark a handoff as completed with outputs |
| `query_workflow_state` | Query handoff state and history |
| `attach_context` | Attach structured context to a handoff |
| `get_context` | Retrieve context for a handoff |

### MCP Configuration (VS Code)

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "agentcraftworks": {
      "command": "node",
      "args": ["--import", "tsx", "typescript/src/mcp/server.ts"],
      "env": {
        "GH_APP_ID": "your-app-id",
        "GH_PRIVATE_KEY": "your-private-key",
        "GH_WEBHOOK_SECRET": "your-webhook-secret"
      }
    }
  }
}
```

## Project Structure

```
typescript/
├── src/
│   ├── types/           # TypeScript type definitions
│   │   ├── handoff.ts   # Handoff, StateChange, HandoffStats types
│   │   ├── autonomy.ts  # Engagement levels, action tiers
│   │   ├── context.ts   # Context service types
│   │   └── index.ts     # Re-exports
│   ├── utils/           # Core utilities
│   │   ├── handoff-state-machine.ts  # 4-state FSM
│   │   ├── codeowners.ts             # CODEOWNERS parser
│   │   └── auth.ts                   # GitHub App auth
│   ├── services/        # Business logic
│   │   ├── handoff-service.ts    # Handoff CRUD + transitions
│   │   ├── action-classifier.ts  # T1-T5 action classification
│   │   ├── autonomy-dial.ts      # Engagement level management
│   │   ├── context-service.ts    # Structured context storage
│   │   └── context-schemas.ts    # JSON Schema validation
│   ├── middleware/      # Express middleware
│   │   ├── webhook-signature.ts   # HMAC-SHA256 verification
│   │   └── permission-checker.ts  # Engagement level gating
│   ├── handlers/        # Route handlers
│   │   ├── pull-request.ts        # PR webhook processing
│   │   ├── handoff-api.ts         # REST API for handoffs
│   │   └── autonomy-dial-routes.ts # Autonomy dial API
│   ├── mcp/             # Model Context Protocol
│   │   ├── server.ts    # MCP tool implementations
│   │   └── types.ts     # MCP-specific types
│   └── index.ts         # Application entry point
└── test/                # Test suite (node:test)
    ├── handoff-state-machine.test.ts
    ├── handoff-service.test.ts
    ├── handoff-edge-cases.test.ts
    ├── action-classifier.test.ts
    ├── autonomy-dial-routes.test.ts
    ├── codeowners-permission.test.ts
    ├── context-service.test.ts
    ├── mcp-server.test.ts
    ├── pull-request.test.ts
    ├── handoff-api.test.ts
    ├── webhook-signature.test.ts
    └── webhook-endpoint.test.ts
```

## Coding Conventions

- **Runtime**: Node.js 22+ with ES Modules
- **Build**: esbuild for compilation, `tsc --noEmit` for type checking
- **Testing**: `node --import tsx --test test/**/*.test.ts`
- **Types**: Use `unknown` over `any`, strict null checks enabled
- **Logging**: Structured `{ msg, key: value }` pattern
- **GitHub API**: Use `octokit.request()`, NOT `.rest.*` methods (Octokit v16+)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

[MIT](LICENSE)
