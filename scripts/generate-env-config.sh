#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=lib/load-deploy-env.sh
source "${ROOT_DIR}/scripts/lib/load-deploy-env.sh"

if [[ -f "${ROOT_DIR}/config/deploy.env" ]]; then
  load_deploy_env "${ROOT_DIR}"
fi

resolve_terraform_context "${ROOT_DIR}"

if [[ -z "${TF_VAR_fcm_service_account_json:-}" ]]; then
  echo "TF_VAR_fcm_service_account_json is required" >&2
  exit 1
fi

TEMPLATE_DIR="${ROOT_DIR}/templates/configs/region/env"
mkdir -p "${TF_CONFIG_DIR}"

escape_for_sed() {
  printf '%s' "$1" | sed -e 's/[\\/&|]/\\&/g'
}

REGION_ESCAPED="$(escape_for_sed "${TF_VAR_region}")"
ENV_ESCAPED="$(escape_for_sed "${TF_infra_env}")"
PROJECT_ESCAPED="$(escape_for_sed "${TF_VAR_project_name:-distribution-webhook}")"

sed \
  -e "s|__TF_VAR_region__|${REGION_ESCAPED}|g" \
  -e "s|__TF_infra_env__|${ENV_ESCAPED}|g" \
  -e "s|__TF_VAR_project_name__|${PROJECT_ESCAPED}|g" \
  "${TEMPLATE_DIR}/config.tfvars" > "${TF_CONFIG_FILE}"

if [[ -n "${TF_VAR_medallia_oauth_token_url:-}" ]]; then
  OAUTH_URL_ESCAPED="$(escape_for_sed "${TF_VAR_medallia_oauth_token_url}")"
  if grep -q '^# medallia_oauth_token_url' "${TF_CONFIG_FILE}"; then
    sed -i.bak "s|# medallia_oauth_token_url = .*|medallia_oauth_token_url = \"${OAUTH_URL_ESCAPED}\"|" "${TF_CONFIG_FILE}"
  else
    printf '\nmedallia_oauth_token_url = "%s"\n' "${TF_VAR_medallia_oauth_token_url}" >> "${TF_CONFIG_FILE}"
  fi
  rm -f "${TF_CONFIG_FILE}.bak"
fi

python3 - "${TF_SECRETS_FILE}" <<'PY'
import json
import os
import sys

output_path = sys.argv[1]

def hcl_string(value):
    """Produce a double-quoted string safe for HCL/Terraform tfvars."""
    return json.dumps(value)

lines = [
    f'fcm_service_account_json = {hcl_string(os.environ["TF_VAR_fcm_service_account_json"])}',
]

if os.environ.get("TF_VAR_medallia_oauth_client_id"):
    lines.append(
        f'medallia_oauth_client_id = {hcl_string(os.environ["TF_VAR_medallia_oauth_client_id"])}'
    )

if os.environ.get("TF_VAR_medallia_oauth_client_secret"):
    lines.append(
        'medallia_oauth_client_secret = '
        f'{hcl_string(os.environ["TF_VAR_medallia_oauth_client_secret"])}'
    )

with open(output_path, "w", encoding="utf-8") as handle:
    handle.write("\n".join(lines))
    handle.write("\n")
PY

echo "Generated environment config:"
echo "  Workspace: ${TF_workspace}"
echo "  Config:    ${TF_CONFIG_FILE}"
echo "  Secrets:   ${TF_SECRETS_FILE}"
