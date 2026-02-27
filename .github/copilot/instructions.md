# GitHub Copilot Instructions — AgentCraftworks CE

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

## Environment Strategy
- Feature branches → CI only (build + test)
- `staging` branch → Deploy to staging Azure environment
- `main` branch → Deploy to production Azure environment
- Infrastructure provisioning → `deploy-azd.yml` (manual trigger with environment selection)
