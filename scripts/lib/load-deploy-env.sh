#!/usr/bin/env bash
set -euo pipefail

load_deploy_env() {
  local root_dir="$1"
  local env_file="${DEPLOY_ENV_FILE:-${root_dir}/config/deploy.env}"

  if [[ ! -f "${env_file}" ]]; then
    echo "Missing ${env_file}" >&2
    echo "Copy config/deploy.env.example to config/deploy.env and fill in your values." >&2
    exit 1
  fi

  # shellcheck disable=SC1090
  set -a
  source "${env_file}"
  set +a

  if [[ -z "${AWS_REGION:-}" ]]; then
    echo "AWS_REGION is required in ${env_file}" >&2
    exit 1
  fi

  export AWS_DEFAULT_REGION="${AWS_REGION}"
  export AWS_REGION

  if [[ -n "${AWS_PROFILE:-}" ]]; then
    export AWS_PROFILE
  elif [[ -n "${AWS_ACCESS_KEY_ID:-}" && -n "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
    export AWS_ACCESS_KEY_ID
    export AWS_SECRET_ACCESS_KEY
    if [[ -n "${AWS_SESSION_TOKEN:-}" ]]; then
      export AWS_SESSION_TOKEN
    fi
  else
    echo "Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or AWS_PROFILE in ${env_file}" >&2
    exit 1
  fi
}

resolve_terraform_context() {
  local root_dir="$1"

  export TF_VAR_region="${TF_VAR_region:-${AWS_REGION:-}}"
  export TF_infra_env="${TF_infra_env:-${ENVIRONMENT:-}}"

  if [[ -z "${TF_VAR_region}" ]]; then
    echo "TF_VAR_region or AWS_REGION is required" >&2
    exit 1
  fi

  if [[ -z "${TF_infra_env}" ]]; then
    echo "TF_infra_env or ENVIRONMENT is required" >&2
    exit 1
  fi

  export TF_workspace="${TF_workspace:-${TF_VAR_region}-${TF_infra_env}}"
  export TF_CONFIG_DIR="${root_dir}/infra/terraform/configs/${TF_VAR_region}/${TF_infra_env}"
  export TF_CONFIG_FILE="${TF_CONFIG_DIR}/config.tfvars"
  export TF_SECRETS_FILE="${TF_CONFIG_DIR}/secrets.auto.tfvars"
}
