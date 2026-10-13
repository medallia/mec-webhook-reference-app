# Local Deployment Configuration

Client-specific AWS credentials and generated Terraform environment configs live here and are **not committed to git**.

## Quick start

```bash
cp config/deploy.env.example config/deploy.env
# Edit config/deploy.env with AWS credentials or AWS_PROFILE

export TF_VAR_region=us-east-1
export TF_infra_env=dev
export TF_VAR_fcm_service_account_json='...'

./scripts/validate-state-backend.sh
./scripts/generate-env-config.sh
./scripts/terraform.sh plan
./scripts/terraform.sh apply
```

## Files

| File | In git? | Purpose |
|------|---------|---------|
| `deploy.env.example` | Yes | Template for local AWS credentials |
| `deploy.env` | No | Your AWS credentials and default region |
| `../templates/configs/region/env/` | Yes | Committed templates for generated Terraform config |
| `../infra/terraform/configs/<region>/<env>/` | No | Generated `config.tfvars` and `secrets.auto.tfvars` |

## deploy.env settings

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_ACCESS_KEY_ID` | Yes* | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Yes* | AWS secret key |
| `AWS_SESSION_TOKEN` | No | Temporary credentials |
| `AWS_PROFILE` | Yes* | Alternative to access keys |
| `AWS_REGION` | Yes | AWS region for deployed resources |

\* Provide either access keys or `AWS_PROFILE`.

Remote state bucket and lock table are hardcoded in [`infra/terraform/terraform.tf`](infra/terraform/terraform.tf):

- Bucket: `medallia-webhook-demo-terraform-state-storage-s3`
- Lock table: `medallia-webhook-demo-terraform-state-lock-dynamo`

State is isolated per environment using Terraform workspaces named `{region}-{env}` (for example `us-east-1-dev`).

## Secret values

Secrets are **not** stored in `deploy.env`. Provide them when generating config:

| Variable | Required | Description |
|----------|----------|-------------|
| `TF_VAR_fcm_service_account_json` | Yes | Firebase service account JSON |
| `TF_VAR_medallia_oauth_token_url` | No | Medallia OAuth token URL |
| `TF_VAR_medallia_oauth_client_id` | No | Medallia OAuth client ID |
| `TF_VAR_medallia_oauth_client_secret` | No | Medallia OAuth client secret |

## iOS App Store publish

```bash
cp config/ios-publish.env.example config/ios-publish.env
# Edit signing team, provisioning profile, and App Store Connect API credentials

cd mobile && cp .env.example .env   # production API URL + device key
chmod +x ../scripts/publish-ios.sh
../scripts/publish-ios.sh
```

See `config/ios-publish.env.example` for all options. Use `--skip-upload` to produce an IPA without uploading.

Before archiving in Xcode directly, run a local build:

```bash
./scripts/build-ios.sh
# or faster simulator-only compile check:
./scripts/build-ios.sh --simulator
```

Install JS deps first if needed: `cd mobile && npm install`

If archive fails on `EXConstants` / `expo-build-properties`, `node_modules` is usually out of date.

If you see Yoga header errors (for example `LayoutableChildren.h` not found), Pods are stale:

```bash
cd mobile/ios
rm -rf Pods Podfile.lock build
pod install
```

## Security

- Never commit `deploy.env`, `ios-publish.env`, or generated files under `infra/terraform/configs/`
- Prefer IAM roles or short-lived credentials over long-lived access keys in production
