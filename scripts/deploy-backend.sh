#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
TERRAFORM_DIR="${ROOT_DIR}/infra/terraform"

echo "Building backend Lambda bundles..."
cd "${BACKEND_DIR}"
npm install
npm run build

echo "Backend bundles written to backend/dist/lambda/*.zip"
echo "Deploy infrastructure with:"
echo "  cd infra/terraform && terraform apply"
