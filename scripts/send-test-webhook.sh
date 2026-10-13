#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <api-base-url> [basic-auth-user] [basic-auth-pass]"
  echo "Example: $0 https://abc123.execute-api.us-east-1.amazonaws.com webhook-user secret"
  exit 1
fi

API_BASE_URL="${1%/}"
AUTH_USER="${2:-webhook-user}"
AUTH_PASS="${3:-}"

if [[ -z "${AUTH_PASS}" ]]; then
  read -r -s -p "Basic auth password: " AUTH_PASS
  echo
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE="${ROOT_DIR}/backend/tests/fixtures/distribution-request.json"

echo "Sending auth check..."
curl -sS -X POST "${API_BASE_URL}/distribute" \
  -H "Content-Type: application/cloudevents+json" \
  -u "${AUTH_USER}:${AUTH_PASS}" \
  -d '{
    "specversion": "1.0",
    "id": "00000000-0000-4000-8000-000000000001",
    "source": "urn:medallia:services:broadcaster",
    "type": "com.medallia.survey.invitation.authcheck",
    "time": "2026-08-24T18:00:00.000Z"
  }' | python3 -m json.tool

echo
echo "Sending distribution request..."
curl -sS -X POST "${API_BASE_URL}/distribute" \
  -H "Content-Type: application/cloudevents+json" \
  -u "${AUTH_USER}:${AUTH_PASS}" \
  -d @"${FIXTURE}" | python3 -m json.tool
