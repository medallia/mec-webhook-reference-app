#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TERRAFORM_DIR="${ROOT_DIR}/infra/terraform"

# shellcheck source=lib/load-deploy-env.sh
source "${ROOT_DIR}/scripts/lib/load-deploy-env.sh"

usage() {
  cat <<'EOF'
Usage: scripts/terraform.sh <command> [terraform args...]

Commands:
  init      Initialize Terraform and select/create workspace
  plan      Run terraform plan (build backend bundles first if missing)
  apply     Run terraform apply
  destroy   Run terraform destroy
  output    Run terraform output
  validate  Run terraform validate against the configured backend

Environment:
  export TF_VAR_region=us-east-1
  export TF_infra_env=dev
  export TF_VAR_fcm_service_account_json='...'

Optional:
  config/deploy.env for AWS credentials (AWS_PROFILE or access keys)

Before plan/apply, run:
  ./scripts/generate-env-config.sh
EOF
}

ensure_backend_bundles() {
  if [[ ! -f "${ROOT_DIR}/backend/dist/lambda/distribute.zip" ]]; then
    echo "Lambda bundles not found; building backend..."
    "${ROOT_DIR}/scripts/deploy-backend.sh"
  fi
}

ensure_env_config() {
  if [[ ! -f "${TF_CONFIG_FILE}" || ! -f "${TF_SECRETS_FILE}" ]]; then
    echo "Missing generated config in ${TF_CONFIG_DIR}" >&2
    echo "Run ./scripts/generate-env-config.sh first." >&2
    exit 1
  fi
}

terraform_var_files() {
  echo "-var-file=${TF_CONFIG_FILE}"
  echo "-var-file=${TF_SECRETS_FILE}"
}

init_workspace() {
  terraform init -input=false "$@"
  if terraform workspace select "${TF_workspace}" >/dev/null 2>&1; then
    echo "Selected workspace: ${TF_workspace}"
  else
    terraform workspace new "${TF_workspace}"
    echo "Created workspace: ${TF_workspace}"
  fi
}

run_terraform() {
  local command="$1"
  shift

  if [[ -f "${ROOT_DIR}/config/deploy.env" ]]; then
    load_deploy_env "${ROOT_DIR}"
  elif [[ -z "${AWS_ACCESS_KEY_ID:-}" && -z "${AWS_PROFILE:-}" ]]; then
    echo "Missing AWS credentials. Provide config/deploy.env or AWS env vars." >&2
    exit 1
  fi

  if [[ -z "${AWS_REGION:-}" && -n "${AWS_DEFAULT_REGION:-}" ]]; then
    export AWS_REGION="${AWS_DEFAULT_REGION}"
  fi

  resolve_terraform_context "${ROOT_DIR}"

  cd "${TERRAFORM_DIR}"

  case "${command}" in
    init)
      init_workspace "$@"
      ;;
    plan)
      ensure_env_config
      ensure_backend_bundles
      init_workspace
      # shellcheck disable=SC2046
      terraform plan -input=false -out=tfplan $(terraform_var_files) "$@"
      ;;
    apply)
      ensure_env_config
      ensure_backend_bundles
      init_workspace
      if [[ -f tfplan ]]; then
        terraform apply -input=false -auto-approve tfplan "$@"
      else
        # shellcheck disable=SC2046
        terraform apply -input=false $(terraform_var_files) "$@"
      fi
      ;;
    destroy)
      ensure_env_config
      init_workspace
      # shellcheck disable=SC2046
      terraform destroy -input=false $(terraform_var_files) "$@"
      ;;
    output)
      init_workspace
      terraform output "$@"
      ;;
    validate)
      init_workspace
      terraform validate "$@"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

run_terraform "$@"
