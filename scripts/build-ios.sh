#!/usr/bin/env bash
#
# Compile the iOS app locally (Release) before archiving in Xcode or publish-ios.sh.
#
# Usage:
#   ./scripts/build-ios.sh
#   ./scripts/build-ios.sh --simulator   # faster compile check without device signing
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="${ROOT_DIR}/mobile"
IOS_DIR="${MOBILE_DIR}/ios"
BUILD_DIR="${IOS_DIR}/build/local"
DERIVED_DATA="${BUILD_DIR}/DerivedData"

SCHEME="${IOS_SCHEME:-WebhookInvitesDemo}"
WORKSPACE="${IOS_WORKSPACE:-WebhookInvitesDemo.xcworkspace}"
CONFIGURATION="${IOS_CONFIGURATION:-Release}"
TEAM_ID="${IOS_DEVELOPMENT_TEAM:-375EPY5652}"
PROVISIONING_PROFILE="${IOS_PROVISIONING_PROFILE:-DEMO mecwebhook}"
CODE_SIGN_IDENTITY="${IOS_CODE_SIGN_IDENTITY:-iPhone Distribution}"
SIGNING_STYLE="${IOS_CODE_SIGN_STYLE:-manual}"

USE_SIMULATOR=false
SKIP_POD_INSTALL=false
SKIP_NPM_INSTALL=false

usage() {
  cat <<'EOF'
Usage: ./scripts/build-ios.sh [options]

Options:
  --simulator         Build for iOS Simulator (skips distribution signing)
  --skip-pod-install  Skip pod install
  --skip-npm-install  Skip npm install
  -h, --help          Show this help

Environment:
  IOS_PUBLISH_ENV_FILE  Path to config file (default: config/ios-publish.env)
EOF
}

log() {
  printf '\n==> %s\n' "$*"
}

die() {
  echo "error: $*" >&2
  exit 1
}

load_env() {
  local env_file="${IOS_PUBLISH_ENV_FILE:-${ROOT_DIR}/config/ios-publish.env}"
  if [[ -f "${env_file}" ]]; then
    log "Loading ${env_file}"
    # shellcheck disable=SC1090
    set -a
    source "${env_file}"
    set +a
  fi

  SCHEME="${IOS_SCHEME:-WebhookInvitesDemo}"
  WORKSPACE="${IOS_WORKSPACE:-WebhookInvitesDemo.xcworkspace}"
  CONFIGURATION="${IOS_CONFIGURATION:-Release}"
  TEAM_ID="${IOS_DEVELOPMENT_TEAM:-375EPY5652}"
  PROVISIONING_PROFILE="${IOS_PROVISIONING_PROFILE:-DEMO mecwebhook}"
  CODE_SIGN_IDENTITY="${IOS_CODE_SIGN_IDENTITY:-iPhone Distribution}"
  SIGNING_STYLE="${IOS_CODE_SIGN_STYLE:-manual}"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --simulator)
        USE_SIMULATOR=true
        ;;
      --skip-pod-install)
        SKIP_POD_INSTALL=true
        ;;
      --skip-npm-install)
        SKIP_NPM_INSTALL=true
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
    shift
  done
}

install_js_dependencies() {
  if [[ "${SKIP_NPM_INSTALL}" == "true" ]]; then
    return
  fi

  log "Installing mobile npm dependencies"
  cd "${MOBILE_DIR}"
  export NODE_ENV=production
  if [[ -f package-lock.json ]]; then
    npm ci || npm install
  else
    npm install
  fi
}

install_pods() {
  if [[ "${SKIP_POD_INSTALL}" == "true" ]]; then
    return
  fi

  log "Installing CocoaPods dependencies"
  cd "${IOS_DIR}"

  local expected_rn_version
  expected_rn_version="$(node -p "require('${MOBILE_DIR}/node_modules/react-native/package.json').version")"
  if [[ -f Podfile.lock ]] && ! grep -q "React-Core (${expected_rn_version})" Podfile.lock; then
    log "Podfile.lock is out of sync with react-native ${expected_rn_version}; reinstalling Pods"
    rm -rf Pods Podfile.lock build
  fi

  pod install
}

build_app() {
  export NODE_ENV=production
  mkdir -p "${BUILD_DIR}"

  local destination
  local -a build_args=(
    build
    -workspace "${IOS_DIR}/${WORKSPACE}"
    -scheme "${SCHEME}"
    -configuration "${CONFIGURATION}"
    -derivedDataPath "${DERIVED_DATA}"
  )

  if [[ "${USE_SIMULATOR}" == "true" ]]; then
    destination='generic/platform=iOS Simulator'
    build_args+=(-destination "${destination}" CODE_SIGNING_ALLOWED=NO)
    log "Building ${SCHEME} (${CONFIGURATION}) for iOS Simulator"
  else
    destination='generic/platform=iOS'
    build_args+=(
      -destination "${destination}"
      DEVELOPMENT_TEAM="${TEAM_ID}"
      CODE_SIGN_STYLE="${SIGNING_STYLE}"
    )
    if [[ "${SIGNING_STYLE}" == "manual" ]]; then
      build_args+=(
        PROVISIONING_PROFILE_SPECIFIER="${PROVISIONING_PROFILE}"
        CODE_SIGN_IDENTITY="${CODE_SIGN_IDENTITY}"
      )
    else
      build_args+=(-allowProvisioningUpdates)
    fi
    log "Building ${SCHEME} (${CONFIGURATION}) for iOS device (pre-archive check)"
  fi

  xcodebuild "${build_args[@]}"
  log "Local iOS build succeeded"
}

main() {
  parse_args "$@"
  load_env

  [[ "$(uname -s)" == "Darwin" ]] || die "iOS builds require macOS with Xcode"
  command -v xcodebuild >/dev/null 2>&1 || die "xcodebuild not found"
  [[ -d "${IOS_DIR}/${WORKSPACE}" ]] || die "Workspace not found: ${IOS_DIR}/${WORKSPACE}"
  [[ -f "${MOBILE_DIR}/.env" ]] || die "Missing ${MOBILE_DIR}/.env"

  install_js_dependencies
  install_pods
  build_app
}

main "$@"
