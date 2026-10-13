#!/usr/bin/env bash
#
# Clean-build, archive, export, and upload the iOS app to App Store Connect.
#
# Usage:
#   ./scripts/publish-ios.sh              # full pipeline
#   ./scripts/publish-ios.sh --skip-upload  # archive + export IPA only
#   ./scripts/publish-ios.sh --upload-only path/to/app.ipa
#
# Configuration:
#   cp config/ios-publish.env.example config/ios-publish.env
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="${ROOT_DIR}/mobile"
IOS_DIR="${MOBILE_DIR}/ios"
BUILD_DIR="${IOS_DIR}/build/release"
ARCHIVE_PATH="${BUILD_DIR}/WebhookInvitesDemo.xcarchive"
EXPORT_DIR="${BUILD_DIR}/export"
IPA_PATH="${EXPORT_DIR}/WebhookInvitesDemo.ipa"
EXPORT_OPTIONS_PLIST="${BUILD_DIR}/ExportOptions.plist"

SCHEME="${IOS_SCHEME:-WebhookInvitesDemo}"
WORKSPACE="${IOS_WORKSPACE:-WebhookInvitesDemo.xcworkspace}"
CONFIGURATION="${IOS_CONFIGURATION:-Release}"
BUNDLE_ID="${IOS_BUNDLE_ID:-com.medallia.demo.mecwebhook}"
TEAM_ID="${IOS_DEVELOPMENT_TEAM:-375EPY5652}"
PROVISIONING_PROFILE="${IOS_PROVISIONING_PROFILE:-DEMO mecwebhook}"
CODE_SIGN_IDENTITY="${IOS_CODE_SIGN_IDENTITY:-iPhone Distribution}"
SIGNING_STYLE="${IOS_CODE_SIGN_STYLE:-manual}"

SKIP_UPLOAD=false
UPLOAD_ONLY=""
SKIP_POD_INSTALL=false
SKIP_NPM_INSTALL=false

usage() {
  cat <<'EOF'
Usage: ./scripts/publish-ios.sh [options]

Options:
  --skip-upload       Build and export IPA only; do not upload to App Store Connect
  --upload-only PATH  Upload an existing IPA (skips build)
  --skip-pod-install  Skip pod install (use when Pods are already up to date)
  --skip-npm-install  Skip npm install in mobile/
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

load_ios_publish_env() {
  local env_file="${IOS_PUBLISH_ENV_FILE:-${ROOT_DIR}/config/ios-publish.env}"
  if [[ -f "${env_file}" ]]; then
    log "Loading ${env_file}"
    # shellcheck disable=SC1090
    set -a
    source "${env_file}"
    set +a
  else
    log "No ${env_file} found — using built-in defaults"
  fi

  SCHEME="${IOS_SCHEME:-WebhookInvitesDemo}"
  WORKSPACE="${IOS_WORKSPACE:-WebhookInvitesDemo.xcworkspace}"
  CONFIGURATION="${IOS_CONFIGURATION:-Release}"
  BUNDLE_ID="${IOS_BUNDLE_ID:-com.medallia.demo.mecwebhook}"
  TEAM_ID="${IOS_DEVELOPMENT_TEAM:-375EPY5652}"
  PROVISIONING_PROFILE="${IOS_PROVISIONING_PROFILE:-DEMO mecwebhook}"
  CODE_SIGN_IDENTITY="${IOS_CODE_SIGN_IDENTITY:-iPhone Distribution}"
  SIGNING_STYLE="${IOS_CODE_SIGN_STYLE:-manual}"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --skip-upload)
        SKIP_UPLOAD=true
        ;;
      --upload-only)
        [[ $# -ge 2 ]] || die "--upload-only requires a path"
        UPLOAD_ONLY="$2"
        shift
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

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

require_macos() {
  [[ "$(uname -s)" == "Darwin" ]] || die "iOS publishing must run on macOS with Xcode"
}

verify_prerequisites() {
  require_macos
  require_command xcodebuild
  require_command xcrun
  require_command node
  require_command npm

  if ! xcodebuild -version >/dev/null 2>&1; then
    die "Xcode command line tools are not available"
  fi

  [[ -d "${IOS_DIR}/${WORKSPACE}" ]] || die "Workspace not found: ${IOS_DIR}/${WORKSPACE}"
  [[ -f "${MOBILE_DIR}/.env" ]] || die "Missing ${MOBILE_DIR}/.env — copy .env.example and set production values"
  [[ -f "${MOBILE_DIR}/GoogleService-Info.plist" ]] || die "Missing ${MOBILE_DIR}/GoogleService-Info.plist"
}

verify_js_dependencies() {
  local required_modules=(
    "expo-build-properties"
    "expo-constants"
    "@react-native-firebase/app"
  )

  for module in "${required_modules[@]}"; do
    [[ -d "${MOBILE_DIR}/node_modules/${module}" ]] || die "Missing npm module '${module}'. Run: cd mobile && npm install"
  done
}

install_js_dependencies() {
  if [[ "${SKIP_NPM_INSTALL}" == "true" ]]; then
    verify_js_dependencies
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

  verify_js_dependencies
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

write_export_options_plist() {
  log "Writing export options to ${EXPORT_OPTIONS_PLIST}"
  mkdir -p "${BUILD_DIR}"

  if [[ "${SIGNING_STYLE}" == "automatic" ]]; then
    cat >"${EXPORT_OPTIONS_PLIST}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>teamID</key>
  <string>${TEAM_ID}</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
EOF
  else
    cat >"${EXPORT_OPTIONS_PLIST}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>teamID</key>
  <string>${TEAM_ID}</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>${BUNDLE_ID}</key>
    <string>${PROVISIONING_PROFILE}</string>
  </dict>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
EOF
  fi
}

clean_build_outputs() {
  log "Cleaning previous iOS release artifacts"
  rm -rf "${BUILD_DIR}"
  mkdir -p "${BUILD_DIR}"

  xcodebuild clean \
    -workspace "${IOS_DIR}/${WORKSPACE}" \
    -scheme "${SCHEME}" \
    -configuration "${CONFIGURATION}" \
    -derivedDataPath "${BUILD_DIR}/DerivedData"
}

archive_app() {
  log "Archiving ${SCHEME} (${CONFIGURATION})"
  mkdir -p "${BUILD_DIR}"
  export NODE_ENV=production

  local -a archive_args=(
    archive
    -workspace "${IOS_DIR}/${WORKSPACE}"
    -scheme "${SCHEME}"
    -configuration "${CONFIGURATION}"
    -archivePath "${ARCHIVE_PATH}"
    -destination "generic/platform=iOS"
    -derivedDataPath "${BUILD_DIR}/DerivedData"
    DEVELOPMENT_TEAM="${TEAM_ID}"
    CODE_SIGN_STYLE="${SIGNING_STYLE}"
  )

  if [[ "${SIGNING_STYLE}" == "manual" ]]; then
    archive_args+=(
      PROVISIONING_PROFILE_SPECIFIER="${PROVISIONING_PROFILE}"
      CODE_SIGN_IDENTITY="${CODE_SIGN_IDENTITY}"
    )
  else
    archive_args+=(-allowProvisioningUpdates)
  fi

  xcodebuild "${archive_args[@]}"

  [[ -d "${ARCHIVE_PATH}" ]] || die "Archive was not created at ${ARCHIVE_PATH}"
}

export_ipa() {
  log "Exporting App Store IPA"
  mkdir -p "${EXPORT_DIR}"
  write_export_options_plist

  local -a export_args=(
    -exportArchive
    -archivePath "${ARCHIVE_PATH}"
    -exportPath "${EXPORT_DIR}"
    -exportOptionsPlist "${EXPORT_OPTIONS_PLIST}"
  )

  if [[ "${SIGNING_STYLE}" == "automatic" ]]; then
    export_args+=(-allowProvisioningUpdates)
  fi

  xcodebuild "${export_args[@]}"

  if [[ ! -f "${IPA_PATH}" ]]; then
    local found_ipa
    found_ipa="$(find "${EXPORT_DIR}" -maxdepth 1 -name '*.ipa' | head -n 1 || true)"
    [[ -n "${found_ipa}" ]] || die "Export completed but no IPA was found in ${EXPORT_DIR}"
    IPA_PATH="${found_ipa}"
  fi

  log "IPA ready: ${IPA_PATH}"
}

setup_api_key_path() {
  if [[ -z "${APP_STORE_CONNECT_API_KEY_PATH:-}" ]]; then
    return
  fi

  [[ -f "${APP_STORE_CONNECT_API_KEY_PATH}" ]] || die "API key file not found: ${APP_STORE_CONNECT_API_KEY_PATH}"

  local private_keys_dir="${ROOT_DIR}/private_keys"
  mkdir -p "${private_keys_dir}"
  local key_id="${APP_STORE_CONNECT_API_KEY_ID}"
  local dest="${private_keys_dir}/AuthKey_${key_id}.p8"

  if [[ ! -f "${dest}" ]]; then
    cp "${APP_STORE_CONNECT_API_KEY_PATH}" "${dest}"
  fi
}

upload_to_app_store_connect() {
  local ipa="$1"
  [[ -f "${ipa}" ]] || die "IPA not found: ${ipa}"

  log "Uploading ${ipa} to App Store Connect"

  if [[ -n "${APP_STORE_CONNECT_API_KEY_ID:-}" && -n "${APP_STORE_CONNECT_API_ISSUER_ID:-}" ]]; then
    setup_api_key_path
    xcrun altool --upload-app \
      --type ios \
      --file "${ipa}" \
      --apiKey "${APP_STORE_CONNECT_API_KEY_ID}" \
      --apiIssuer "${APP_STORE_CONNECT_API_ISSUER_ID}"
    return
  fi

  if [[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
    xcrun altool --upload-app \
      --type ios \
      --file "${ipa}" \
      --username "${APPLE_ID}" \
      --password "${APPLE_APP_SPECIFIC_PASSWORD}"
    return
  fi

  die "Configure App Store Connect credentials in config/ios-publish.env (API key or Apple ID)"
}

build_and_export() {
  verify_prerequisites
  install_js_dependencies
  install_pods
  log "Running local Release build before archive"
  "${ROOT_DIR}/scripts/build-ios.sh" --skip-npm-install --skip-pod-install
  clean_build_outputs
  archive_app
  export_ipa
}

main() {
  parse_args "$@"
  load_ios_publish_env

  if [[ -n "${UPLOAD_ONLY}" ]]; then
    if [[ "${SKIP_UPLOAD}" == "true" ]]; then
      die "--upload-only cannot be combined with --skip-upload"
    fi
    upload_to_app_store_connect "${UPLOAD_ONLY}"
    log "Upload complete"
    exit 0
  fi

  build_and_export

  if [[ "${SKIP_UPLOAD}" == "true" ]]; then
    log "Skipping upload (--skip-upload)"
    log "Next: ./scripts/publish-ios.sh --upload-only \"${IPA_PATH}\""
    exit 0
  fi

  upload_to_app_store_connect "${IPA_PATH}"
  log "Publish complete"
  log "Check App Store Connect > TestFlight for processing status"
}

main "$@"
