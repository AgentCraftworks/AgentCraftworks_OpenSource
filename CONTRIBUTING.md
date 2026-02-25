# Contributing to AgentCraftworks Core

Thank you for your interest in contributing to AgentCraftworks! This document provides guidelines for contributing to the open-source core.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/AgentCraftworks_OpenSource.git`
3. Install dependencies: `cd typescript && npm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development Setup

### Prerequisites

- Node.js 22+
- npm 10+

### Commands

```bash
cd typescript
npm install             # Install dependencies
npm run build           # Build with esbuild
npm run typecheck       # Type check with tsc --noEmit
node --import tsx --test test/**/*.test.ts  # Run tests
```

## Coding Standards

### TypeScript

- **Strict mode**: `strict: true` in tsconfig.json
- **Prefer `unknown`**: over `any`
- **ES Modules**: Use `.js` extensions in imports
- **Structured logging**: `{ msg, key: value }` pattern

### Testing

- Use `node:test` (built-in Node.js test runner)
- Use `node:assert/strict` for assertions
- Each test file should have a clear describe/it structure
- Integration tests use Express + fetch pattern with ephemeral servers (port 0)

### Architecture Standards

Before implementing patterns covered by the architecture standards in `ArchitecturePatternsPractices/`, read the relevant document first:

| Standard | When to Consult |
|----------|-----------------|
| Circuit Breaker | Adding retry logic or external service calls |
| Handoff State Machine | Any handoff state transition changes |
| Engagement Level Governance | Permission check or action tier code |

## Pull Request Process

1. Ensure all tests pass: `node --import tsx --test test/**/*.test.ts`
2. Ensure type checking passes: `npm run typecheck`
3. Write tests for new functionality
4. Update documentation if needed
5. Use conventional commit messages:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `test:` for test additions/changes
   - `docs:` for documentation
   - `refactor:` for code restructuring

## Architecture Decision Records

To deviate from a locked standard, create an ADR in `ArchitecturePatternsPractices/adr/` using the template.

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
