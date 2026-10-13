# Jenkins CI/CD

This repository includes a declarative [`Jenkinsfile`](../Jenkinsfile) that covers validation, build, AWS deployment, optional mobile builds, and post-deploy smoke testing.

## Pipeline Overview

| Stage | When | Purpose |
|-------|------|---------|
| Initialize | Always | Branch guard for deployments, script permissions |
| Verify Toolchain | Always | Confirms Node.js, npm, Terraform, and AWS CLI are available |
| CI (parallel) | Always | Backend lint/test/build, mobile lint, Terraform validate/fmt |
| Generate Environment Config | `RUN_DEPLOY=true` | Writes gitignored `infra/terraform/configs/<region>/<env>/` from templates |
| Terraform Plan | `RUN_DEPLOY=true` | Init, select workspace, plan with generated var-files |
| Deploy Infrastructure | `RUN_DEPLOY=true` | Applies Terraform and archives outputs |
| Deploy Lambda Code | `RUN_DEPLOY=true` | Publishes zip artifacts to Lambda functions |
| Build Mobile | `RUN_DEPLOY=true` and `BUILD_MOBILE=true` | Submits EAS builds for iOS and Android |
| Smoke Test | Deploy + `RUN_SMOKE_TEST=true` | Sends auth-check webhook to deployed API |

## Required Jenkins Plugins

- Pipeline
- Pipeline: AWS Steps (`withAWS`)
- Credentials Binding
- JUnit (optional; tests currently run via Vitest without JUnit output)
- Workspace Cleanup

## Agent Requirements

Install on the Jenkins agent:

- Node.js 22+
- Terraform >= 1.5
- AWS CLI v2
- Python 3
- zip/unzip
- curl

For mobile builds (`BUILD_MOBILE=true`):

- EAS CLI (installed by the pipeline)
- Valid Expo account token

## Jenkins Credentials

Create these credentials in Jenkins before running deploy stages:

| Credential ID | Type | Required For |
|---------------|------|--------------|
| `distribution-webhook-aws` | AWS Credentials | Terraform apply, Lambda deploy, smoke test infrastructure |
| `distribution-webhook-fcm-service-account-json` | Secret text | Generated `secrets.auto.tfvars` |
| `distribution-webhook-eas-token` | Secret text | Optional EAS mobile builds |

Optional Medallia OAuth values can be supplied by setting Jenkins global environment variables before the pipeline runs:

- `TF_VAR_medallia_oauth_token_url`
- `TF_VAR_medallia_oauth_client_id`
- `TF_VAR_medallia_oauth_client_secret`

## Terraform Remote State

Remote state is hardcoded in [`infra/terraform/terraform.tf`](../infra/terraform/terraform.tf):

- Bucket: `medallia-webhook-demo-terraform-state-storage-s3`
- Lock table: `medallia-webhook-demo-terraform-state-lock-dynamo`
- Workspace prefix: `distribution-webhook`
- Workspace name: `{AWS_REGION}-{ENVIRONMENT}` (for example `us-east-1-dev`)

Jenkins generates per-environment config files before plan/apply. Generated config is gitignored and not committed.

## Pipeline Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `ENVIRONMENT` | `dev` | Terraform `environment` variable |
| `AWS_REGION` | `us-east-1` | AWS region |
| `PROJECT_NAME` | `distribution-webhook` | Resource name prefix |
| `RUN_DEPLOY` | `false` | Enable CD stages |
| `BUILD_MOBILE` | `false` | Submit EAS builds |
| `RUN_SMOKE_TEST` | `true` | Run auth-check smoke test after deploy |

Deployments are restricted to `main` or `master` branches.

## Typical Usage

### CI only (pull requests and feature branches)

Run the job with defaults:

- `RUN_DEPLOY=false`

This executes backend tests/build, mobile lint, and Terraform validation.

### Full CD to dev

On `main`:

- `ENVIRONMENT=dev`
- `AWS_REGION=us-east-1`
- `RUN_DEPLOY=true`
- `RUN_SMOKE_TEST=true`

This will:

1. Build Lambda zip artifacts
2. Generate environment config from templates + Jenkins credentials
3. Plan and apply Terraform in workspace `us-east-1-dev`
4. Update Lambda function code
5. Verify the `/distribute` auth-check endpoint

### CD with mobile builds

Add:

- `BUILD_MOBILE=true`

Ensure `distribution-webhook-eas-token` is configured and the Expo project is linked.

## Helper Scripts

| Script | Purpose |
|--------|---------|
| [`scripts/generate-env-config.sh`](../scripts/generate-env-config.sh) | Generates gitignored per-env Terraform config |
| [`scripts/terraform.sh`](../scripts/terraform.sh) | Local init/plan/apply with workspace + var-files |
| [`scripts/validate-state-backend.sh`](../scripts/validate-state-backend.sh) | Verifies shared S3/DynamoDB backend exists |
| [`scripts/jenkins-deploy-lambdas.sh`](../scripts/jenkins-deploy-lambdas.sh) | Updates all five Lambda functions from `backend/dist/lambda/*.zip` |
| [`scripts/jenkins-smoke-test.sh`](../scripts/jenkins-smoke-test.sh) | Sends sample auth-check CloudEvent to deployed API |

## Artifacts

Successful builds archive:

- `backend/dist/lambda/*.zip`
- `infra/terraform/tfplan` (deploy builds)
- `terraform-outputs.json` (deploy builds)

## Troubleshooting

| Issue | Resolution |
|-------|------------|
| Terraform backend errors | Verify shared bucket/table exist; run `./scripts/validate-state-backend.sh` |
| Missing generated config | Ensure Generate Environment Config stage ran and FCM credential is configured |
| Missing FCM credential | Add `distribution-webhook-fcm-service-account-json` secret text credential |
| Lambda name mismatch | Ensure `PROJECT_NAME` and `ENVIRONMENT` match Terraform variables |
| Smoke test 401 | Confirm Terraform apply completed and outputs were archived |
| EAS build fails | Verify Expo token, project ID in `mobile/app.config.js`, and Firebase config files |
