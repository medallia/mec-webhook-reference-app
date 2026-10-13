#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=lib/load-deploy-env.sh
source "${ROOT_DIR}/scripts/lib/load-deploy-env.sh"

STATE_BUCKET="medallia-webhook-demo-terraform-state-storage-s3"
LOCK_TABLE="medallia-webhook-demo-terraform-state-lock-dynamo"
STATE_REGION="us-east-1"

if [[ -f "${ROOT_DIR}/config/deploy.env" ]]; then
  load_deploy_env "${ROOT_DIR}"
elif [[ -z "${AWS_ACCESS_KEY_ID:-}" && -z "${AWS_PROFILE:-}" ]]; then
  echo "Missing AWS credentials. Provide config/deploy.env or AWS env vars." >&2
  exit 1
fi

export AWS_DEFAULT_REGION="${AWS_REGION:-${STATE_REGION}}"

echo "Validating Terraform remote state backend..."
echo "  Bucket: ${STATE_BUCKET} (region: ${STATE_REGION})"
echo "  Lock table: ${LOCK_TABLE}"

if ! aws s3api head-bucket --bucket "${STATE_BUCKET}" --region "${STATE_REGION}" >/dev/null 2>&1; then
  echo "ERROR: S3 bucket '${STATE_BUCKET}' was not found or is not accessible." >&2
  exit 1
fi

TABLE_JSON="$(aws dynamodb describe-table \
  --table-name "${LOCK_TABLE}" \
  --region "${STATE_REGION}" \
  --output json)"

TABLE_STATUS="$(echo "${TABLE_JSON}" | python3 -c "import json,sys; print(json.load(sys.stdin)['Table']['TableStatus'])")"
KEY_SCHEMA="$(echo "${TABLE_JSON}" | python3 -c "import json,sys; print(json.load(sys.stdin)['Table']['KeySchema'][0]['AttributeName'])")"

if [[ "${TABLE_STATUS}" != "ACTIVE" ]]; then
  echo "ERROR: DynamoDB table '${LOCK_TABLE}' is not ACTIVE (status: ${TABLE_STATUS})." >&2
  exit 1
fi

if [[ "${KEY_SCHEMA}" != "LockID" ]]; then
  echo "ERROR: DynamoDB table '${LOCK_TABLE}' must use LockID as the hash key (found: ${KEY_SCHEMA})." >&2
  exit 1
fi

echo "Terraform remote state backend validation passed."
