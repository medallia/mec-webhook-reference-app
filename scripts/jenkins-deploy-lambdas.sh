#!/usr/bin/env bash
set -euo pipefail

# Deploy built Lambda zip artifacts to existing AWS Lambda functions.
#
# Required environment variables:
#   AWS_REGION
#   PROJECT_NAME (default: distribution-webhook)
#   ENVIRONMENT  (default: dev)
#
# Optional:
#   LAMBDA_ARTIFACT_DIR (default: backend/dist/lambda)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_DIR="${LAMBDA_ARTIFACT_DIR:-${ROOT_DIR}/backend/dist/lambda}"
PROJECT_NAME="${PROJECT_NAME:-distribution-webhook}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# function-suffix:zip-filename pairs (bash 3.2 compatible — no associative arrays)
HANDLERS="distribute:distribute push-worker:pushWorker device-register:deviceRegister device-delete:deviceDelete delivery-ack:deliveryAck"

echo "Deploying Lambda artifacts from ${ARTIFACT_DIR}"
echo "Project: ${PROJECT_NAME}, Environment: ${ENVIRONMENT}, Region: ${AWS_REGION}"

for pair in ${HANDLERS}; do
  suffix="${pair%%:*}"
  zipname="${pair##*:}"
  function_name="${PROJECT_NAME}-${ENVIRONMENT}-${suffix}"
  artifact="${ARTIFACT_DIR}/${zipname}.zip"

  if [[ ! -f "${artifact}" ]]; then
    echo "ERROR: Missing artifact ${artifact}" >&2
    exit 1
  fi

  echo "Updating ${function_name} from ${artifact}"
  aws lambda update-function-code \
    --region "${AWS_REGION}" \
    --function-name "${function_name}" \
    --zip-file "fileb://${artifact}" \
    --no-cli-pager \
    >/dev/null

  aws lambda wait function-updated \
    --region "${AWS_REGION}" \
    --function-name "${function_name}"

  echo "  ✓ ${function_name} updated"
done

echo "All Lambda functions updated successfully."
