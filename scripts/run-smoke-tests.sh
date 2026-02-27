#!/bin/bash

# Smoke Test Runner Script
# Runs smoke tests against specified environment

set -e

ENVIRONMENT="${1:-local}"

case "$ENVIRONMENT" in
    local)
        TYPESCRIPT_URL="http://localhost:3000"
        ;;
    production)
        TYPESCRIPT_URL="${TYPESCRIPT_PROD_URL:-https://your-app.azurecontainerapps.io}"
        ;;
    *)
        echo "Usage: $0 [local|production]"
        echo ""
        echo "Examples:"
        echo "  $0 local        # Test against localhost:3000"
        echo "  $0 production   # Test against production URL (set TYPESCRIPT_PROD_URL)"
        exit 1
        ;;
esac

echo "🧪 Running smoke tests against $ENVIRONMENT environment"
echo ""
echo "TypeScript URL: $TYPESCRIPT_URL"
echo ""

# Test TypeScript service
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing TypeScript Service"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd typescript
BASE_URL="$TYPESCRIPT_URL" npx tsx smoke-test.ts
cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All smoke tests passed for $ENVIRONMENT!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
