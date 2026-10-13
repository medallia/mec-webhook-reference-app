#!/usr/bin/env bash
set -euo pipefail

# Post-deploy smoke test for the Distribution Webhook reference implementation.
#
# Required environment variables:
#   SMOKE_TEST_API_BASE_URL
#   SMOKE_TEST_WEBHOOK_USERNAME (default: webhook-user)
#   SMOKE_TEST_WEBHOOK_PASSWORD

API_BASE_URL="${SMOKE_TEST_API_BASE_URL%/}"
AUTH_USER="${SMOKE_TEST_WEBHOOK_USERNAME:-webhook-user}"
AUTH_PASS="${SMOKE_TEST_WEBHOOK_PASSWORD:?SMOKE_TEST_WEBHOOK_PASSWORD is required}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTH_CHECK_PAYLOAD="${ROOT_DIR}/docs/api/sample-auth-check.json"

echo "Running auth-check smoke test against ${API_BASE_URL}/distribute"

response_file="$(mktemp)"
status_code="$(
  curl -sS -o "${response_file}" -w "%{http_code}" \
    -X POST "${API_BASE_URL}/distribute" \
    -H "Content-Type: application/cloudevents+json" \
    -u "${AUTH_USER}:${AUTH_PASS}" \
    -d @"${AUTH_CHECK_PAYLOAD}"
)"

echo "HTTP status: ${status_code}"
cat "${response_file}"
echo

if [[ "${status_code}" != "200" ]]; then
  echo "Smoke test failed: expected HTTP 200 for auth-check" >&2
  exit 1
fi

if ! grep -q "authcheck.success" "${response_file}"; then
  echo "Smoke test failed: response did not contain authcheck.success" >&2
  exit 1
fi

echo "Smoke test passed."
