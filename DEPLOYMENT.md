# Deployment Guide

Complete guide for deploying AgentCraftworks CE to Azure and running locally with Docker.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [GitHub App Setup](#github-app-setup)
- [Local Development](#local-development)
- [Azure Deployment](#azure-deployment)
- [GitHub Secrets for CI/CD](#github-secrets-for-cicd)
- [CI/CD Pipeline](#cicd-pipeline)
- [Smoke Tests](#smoke-tests)
- [Production Deployment Checklist](#production-deployment-checklist)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Cost Estimation](#cost-estimation)
- [Cleanup](#cleanup)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

Get AgentCraftworks CE running on Azure with the Azure Developer CLI:

```bash
# 1. Install Azure Developer CLI (if not already installed)
# macOS/Linux:
curl -fsSL https://aka.ms/install-azd.sh | bash
# Windows (PowerShell):
powershell -ex AllSigned -c "Invoke-RestMethod 'https://aka.ms/install-azd.ps1' | Invoke-Expression"

# 2. Clone and navigate
git clone https://github.com/AgentCraftworks/AgentCraftworks-CE.git
cd AgentCraftworks-CE

# 3. Login and initialize
azd auth login
azd init    # Environment name: agentcraftworks-dev, Location: eastus

# 4. Configure secrets
azd env set GH_WEBHOOK_SECRET "$(openssl rand -hex 32)"
azd env set GH_APP_ID "your-app-id"
azd env set GH_APP_PRIVATE_KEY "$(cat path/to/private-key.pem)"

# 5. Deploy (provisions infrastructure + deploys app)
azd up

# 6. Get your URL
azd env get-values | grep TYPESCRIPT_APP_URL
```

After deployment, update your GitHub App webhook URL to `https://<your-url>/api/webhook`.

---

## Prerequisites

### Local Development

- **Node.js 22+** — For TypeScript service
- **Docker Desktop** — For containerized local development
- **Git** — Version control

### Azure Deployment

- **Azure Subscription** — Active subscription with permissions
- **Azure Developer CLI** (`azd`) — Primary deployment tool
- **Azure CLI** (`az`) — Optional, for additional management
- **GitHub Account** — For CI/CD workflows

---

## GitHub App Setup

> Required for both local and Azure deployments.

### Create the App

1. Go to **https://github.com/settings/apps/new**
2. Fill in:
   - **Name:** `AgentCraftworks` (or `AgentCraftworks-Dev` for development)
   - **Homepage URL:** `https://github.com/AgentCraftworks/AgentCraftworks-CE`
   - **Webhook URL:** Leave blank (update after deploy)
   - **Webhook Secret:** Generate one: `openssl rand -hex 32` — **save this value**
3. **Permissions** (Repository):
   - Contents: Read & Write
   - Issues: Read & Write
   - Pull Requests: Read & Write
   - Metadata: Read-only
   - Checks: Read & Write
   - Commit statuses: Read & Write
4. **Subscribe to events:** Pull request, Pull request review, Issues, Issue comment, Push
5. Click **Create GitHub App**
6. Note the **App ID**

### Generate Private Key

1. On the app settings page, scroll to **Private keys**
2. Click **Generate a private key**
3. Save the downloaded `.pem` file securely

### Install the App

1. Go to **https://github.com/settings/apps/YOUR_APP/installations**
2. Click **Install**
3. Choose your organization or account
4. Select repos (or all repos)

---

## Local Development

### Option 1: Docker Compose (Recommended)

```bash
# 1. Create environment file
cp .env.example .env
# Edit .env with your GitHub App credentials

# 2. Start all services
docker compose up -d --build

# 3. Check service status
docker compose ps

# 4. View logs
docker compose logs -f
docker compose logs -f typescript-api    # TypeScript only

# 5. Test health endpoint
curl http://localhost:3000/health

# 6. Stop services
docker compose down
```

Services started by Docker Compose:
- **TypeScript API**: http://localhost:3000 (health: `/health`)
- **PostgreSQL 17**: localhost:5432 (db: `agentcraftworks`)
- **Redis 7**: localhost:6379

Expected health response:
```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 30.91,
  "timestamp": "2026-02-27T08:00:00.000Z"
}
```

### Option 2: Native Development

```bash
cd typescript

# Install dependencies
npm install

# Set environment variables
export GH_APP_ID=123456
export GH_APP_PRIVATE_KEY="$(cat path/to/private-key.pem)"
export GH_WEBHOOK_SECRET=your_webhook_secret
export PORT=3000

# Development mode (watch)
npm run dev

# Production build
npm run build
npm start
```

### Building the Docker Image Directly

```bash
cd typescript
docker build -t agentcraftworks-ts .
docker run -p 3000:3000 \
  -e GH_WEBHOOK_SECRET="test-secret" \
  -e GH_APP_ID="test-id" \
  -e GH_APP_PRIVATE_KEY="test-key" \
  agentcraftworks-ts
```

---

## Azure Deployment

### Option 1: Azure Developer CLI (azd) — Recommended

```bash
# 1. Login to Azure
azd auth login

# 2. Initialize (first time only)
azd init

# 3. Set secrets
azd env set GH_APP_ID "123456"
azd env set GH_WEBHOOK_SECRET "your_webhook_secret"
azd env set GH_APP_PRIVATE_KEY "$(cat path/to/private-key.pem)"

# 4. Provision and deploy
azd up

# 5. Deploy updates (after initial provisioning)
azd deploy

# 6. Deploy TypeScript service only
azd deploy typescript-api
```

### What Gets Deployed

```
Resource Group (rg-{env-name})
├── Container Apps Environment (cae-{token})
│   └── TypeScript Container App (ca-ts-{token})
├── Container Registry (acr{token})
├── Key Vault (kv-{token})
│   ├── GH-WEBHOOK-SECRET
│   ├── GH-APP-ID
│   └── GH-APP-PRIVATE-KEY
├── PostgreSQL Flexible Server (psql-{token})
│   └── Database: agentcraftworks
├── Redis Cache (redis-{token})
├── Log Analytics Workspace (log-{token})
└── Managed Identity (TypeScript App)
```

### Managed Identity Configuration

The Container App uses a User-Assigned Managed Identity with:
- **Key Vault Secrets User** role for accessing secrets
- **AcrPull** role for pulling container images

### View Environment Info

```bash
azd env get-values
```

Key outputs: `TYPESCRIPT_APP_URL`, `AZURE_KEY_VAULT_NAME`, `AZURE_CONTAINER_REGISTRY_NAME`, `AZURE_POSTGRES_HOST`, `AZURE_REDIS_HOST`

### Option 2: Manual Azure CLI

For more control, deploy with Azure CLI directly:

```bash
# 1. Login and create resource group
az login
az group create --name agentcraftworks-rg --location eastus

# 2. Create container registry
az acr create --resource-group agentcraftworks-rg --name agentcraftworks --sku Basic

# 3. Build and push image
cd typescript
az acr build --registry agentcraftworks --image typescript-api:latest --file Dockerfile .

# 4. Create Container Apps environment
az containerapp env create --name agentcraftworks-env --resource-group agentcraftworks-rg --location eastus

# 5. Deploy
az containerapp create \
  --name typescript-api \
  --resource-group agentcraftworks-rg \
  --environment agentcraftworks-env \
  --image agentcraftworks.azurecr.io/typescript-api:latest \
  --target-port 3000 \
  --ingress external \
  --env-vars GH_APP_ID=123456 GH_WEBHOOK_SECRET=secretref:webhook-secret
```

---

## GitHub Secrets for CI/CD

Configure these in **Settings → Secrets and variables → Actions → New repository secret**:

### Azure Authentication

| Secret | Description | How to Get |
|--------|-------------|------------|
| `AZURE_CLIENT_ID` | Service Principal Client ID | `az ad sp create-for-rbac` output → `appId` |
| `AZURE_TENANT_ID` | Azure AD Tenant ID | `az account show --query tenantId -o tsv` |
| `AZURE_SUBSCRIPTION_ID` | Subscription ID | `az account show --query id -o tsv` |

### Azure Environment

| Secret | Description | Example |
|--------|-------------|---------|
| `AZURE_ENV_NAME` | Deployment environment name | `agentcraftworks-prod` |
| `AZURE_LOCATION` | Azure region | `eastus` |

### GitHub App

| Secret | Description |
|--------|-------------|
| `GH_WEBHOOK_SECRET` | Webhook validation secret (generate: `openssl rand -hex 32`) |
| `GH_APP_ID` | GitHub App ID (from app settings page) |
| `GH_APP_PRIVATE_KEY` | Full PEM file contents including headers |
| `POSTGRES_PASSWORD` | PostgreSQL admin password (generate: `openssl rand -base64 32`) |

### For deploy-production.yml (Docker-based deploy)

| Secret | Description |
|--------|-------------|
| `AZURE_ACR_NAME` | Azure Container Registry name |
| `AZURE_ACR_LOGIN_SERVER` | ACR login server (e.g., `myacr.azurecr.io`) |
| `AZURE_CONTAINER_APP_NAME` | Container App name |
| `AZURE_RESOURCE_GROUP` | Resource group name |
| `TYPESCRIPT_PROD_URL` | Production URL for smoke tests |

### Setting Up Azure Service Principal with Federated Credentials

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
APP_NAME="agentcraftworks-ce-github-actions"

# Create service principal
az ad sp create-for-rbac --name "$APP_NAME" --role contributor \
  --scopes "/subscriptions/$SUBSCRIPTION_ID"

# Get Application ID
APP_ID=$(az ad sp list --display-name "$APP_NAME" --query "[0].appId" -o tsv)

# Add federated credential for main branch (OIDC — no stored secrets)
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-actions-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:AgentCraftworks/AgentCraftworks-CE:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

---

## CI/CD Pipeline

### Workflows

| Workflow | File | Trigger |
|----------|------|---------|
| **TypeScript CI** | `.github/workflows/ci.yml` | Push, PR |
| **azd deploy** | `.github/workflows/deploy-azd.yml` | Push to `main`, `v*` tags, manual |
| **Docker deploy** | `.github/workflows/deploy-production.yml` | Push to `main`, `v*` tags, manual |
| **Changeset** | `.github/workflows/ghaw-changeset.yml` | Push to `main`, manual |
| **CI Coach** | `.github/workflows/ghaw-ci-coach.yml` | CI failure |
| **PR Fix** | `.github/workflows/ghaw-pr-fix.yml` | Check run failure |
| **Workflow Health** | `.github/workflows/ghaw-workflow-health.yml` | Weekday schedule, manual |
| **Test Improver** | `.github/workflows/ghaw-daily-test-improver.yml` | Weekday schedule, manual |
| **CLI Consistency** | `.github/workflows/ghaw-cli-consistency.yml` | PR to `main`, manual |

### Build Process

1. Checkout code
2. Set up Docker Buildx
3. Login to Azure Container Registry
4. Build and push Docker image with caching
5. Update Azure Container App with new image
6. Run smoke tests

### Deployment Strategy

- **Zero-downtime** — Azure Container Apps handle rolling updates
- **Automatic rollback** — Failed health checks trigger rollback
- **Image tagging** — Each deployment tagged with Git SHA

---

## Smoke Tests

### What They Test

1. **Health endpoint** — Service is running and responsive
2. **Handoff API** — Can create handoffs via REST API

### Running Smoke Tests

```bash
# Local
./scripts/run-smoke-tests.sh local

# Production
TYPESCRIPT_PROD_URL=https://your-app.azurecontainerapps.io ./scripts/run-smoke-tests.sh production

# Directly
cd typescript
BASE_URL=http://localhost:3000 npx tsx smoke-test.ts
```

### Expected Output

```
🔍 Running smoke tests against http://localhost:3000
✓ Health endpoint responds (45ms)
✓ Create handoff via API (123ms)
==================================================
Test Summary: Total: 2, Passed: 2, Failed: 0
✅ All smoke tests passed!
```

---

## Production Deployment Checklist

### Pre-Deploy

- [ ] Azure subscription with appropriate permissions
- [ ] Azure CLI / azd installed and configured
- [ ] Docker installed locally (for testing)
- [ ] GitHub App created, private key downloaded, webhook secret generated
- [ ] `.env.example` copied to `.env` with real values
- [ ] Local `docker compose up` runs successfully
- [ ] `curl http://localhost:3000/health` returns 200 OK

### Deploy to Staging

- [ ] `azd init` with staging environment name
- [ ] Secrets configured via `azd env set`
- [ ] `azd up` completes without errors
- [ ] Health endpoint returns 200 OK
- [ ] GitHub App webhook URL updated to staging URL

### Promote to Production

- [ ] Staging validated end-to-end
- [ ] `azd init` with production environment name (or switch with `azd env select`)
- [ ] `azd up` completes without errors
- [ ] Health endpoint returns 200 OK
- [ ] GitHub App webhook URL updated to production URL
- [ ] Create a test PR to verify webhook delivery

---

## Monitoring & Health Checks

### Health Endpoint

`GET /health` returns:
```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 12345.67,
  "timestamp": "2026-02-27T10:30:00.000Z"
}
```

### View Logs

```bash
az containerapp logs show --name ca-ts-{token} --resource-group rg-{env-name} --follow
```

### Azure Monitor KQL

```bash
az monitor log-analytics query \
  --workspace {workspace-id} \
  --analytics-query "ContainerAppConsoleLogs_CL | where TimeGenerated > ago(1h) | limit 100"
```

Or via Azure Portal: Container App → **Monitoring** → **Logs**.

---

## Cost Estimation

Approximate monthly costs:

| Resource | Tier | Est. Cost |
|----------|------|-----------|
| Container Apps Environment | Consumption | $0 |
| Container App (1 app) | 0.5 vCPU, 1GB RAM | ~$15-25/month |
| Container Registry | Basic | ~$5/month |
| PostgreSQL Flexible Server | Burstable B1ms | ~$15-20/month |
| Redis Cache | Basic C0 | ~$17/month |
| Key Vault | Standard | ~$0.03/month |
| Log Analytics | Pay-as-you-go | ~$5-10/month |
| **Total** | | **~$57-77/month** |

Use the [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) for precise estimates.

---

## Cleanup

```bash
# Delete all Azure resources
azd down
```

This deletes all Azure resources and cleans up local environment config. **This is irreversible and deletes all data.**

To remove only the app (keep infrastructure):
```bash
az containerapp delete --name ca-ts-{token} --resource-group rg-{env-name}
```

---

## Troubleshooting

### Docker Build Failures

```bash
# Ensure .dockerignore is present, verify context path in docker-compose.yml
docker compose logs typescript-api
```

### Service Won't Start Locally

```bash
# Check env vars are set, verify PostgreSQL is running
docker compose logs -f
```

### Azure Deployment Fails

```bash
# Check login, resource group, ACR credentials
az account show
azd env get-values
az containerapp logs show --name ca-ts-{token} --resource-group rg-{env-name} --tail 100
```

### Container Can't Pull Image

```bash
# Verify managed identity has AcrPull role
az role assignment list --assignee {principal-id} \
  --scope /subscriptions/{sub}/resourceGroups/rg-{env}/providers/Microsoft.ContainerRegistry/registries/acr{token}
```

### Container Can't Access Key Vault

```bash
# Verify managed identity has Key Vault Secrets User role
az role assignment list --assignee {principal-id} \
  --scope /subscriptions/{sub}/resourceGroups/rg-{env}/providers/Microsoft.KeyVault/vaults/kv{token}
```

### GitHub Actions Workflow Fails

1. Check secrets are configured correctly in GitHub
2. Verify Azure credentials / federated credentials haven't expired
3. Check workflow logs for specific error
4. Ensure Docker image builds locally first
5. Verify Azure resource limits aren't exceeded

### Security Best Practices

1. **Never commit secrets** to source control
2. **Use managed identities** instead of connection strings
3. **Enable diagnostic logging** for all resources
4. **Rebuild containers regularly** for security updates
5. **Consider VNet integration** for production network isolation

---

For more information:
- [README.md](README.md) — Project overview
- [CONTRIBUTING.md](CONTRIBUTING.md) — Contribution guidelines
- [LICENSE](LICENSE) — MIT License
