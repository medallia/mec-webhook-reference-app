# Distribution Webhook Reference Implementation

Open-source reference implementation for integrating with Medallia's Distribution Webhook feature. The project demonstrates how to:

- Receive Medallia CloudEvents on `POST /distribute`
- Queue and process invitations asynchronously
- Deliver survey invitations to a mobile app via Firebase Cloud Messaging (FCM)
- Report delivery status back to Medallia using the callback URL from each invitation

This repository is intended for client teams who want a working end-to-end example built on AWS and React Native.

## Architecture

```text
Medallia SaaS -> API Gateway -> Distribute Lambda -> SQS -> Push Worker Lambda -> FCM -> Mobile App
                                                                                  |
                                                                                  v
                                                                        Medallia Status Callback
```

See [docs/architecture.md](docs/architecture.md) for detailed flows, status lifecycle, and security notes.

## Repository Layout

| Path | Description |
|------|-------------|
| [`backend/`](backend/) | TypeScript AWS Lambda handlers |
| [`infra/terraform/`](infra/terraform/) | AWS infrastructure as code |
| [`mobile/`](mobile/) | React Native (Expo) demo app |
| [`docs/api/`](docs/api/) | Reference OpenAPI specifications |
| [`templates/`](templates/) | Committed per-environment Terraform config templates |
| [`scripts/`](scripts/) | Deployment and testing helpers |
| [`Jenkinsfile`](Jenkinsfile) | Jenkins CI/CD pipeline |

## Prerequisites

- AWS account with permissions to deploy Lambda, API Gateway, DynamoDB, SQS, Secrets Manager, and CloudWatch
- Terraform >= 1.5
- Node.js 22+
- Firebase project with FCM enabled
- For iOS push: APNs key configured in Firebase
- For mobile builds: Xcode (iOS) and/or Android Studio (Android)
- Medallia tenant with Distribution Webhook enabled
- Pre-provisioned Terraform remote state bucket and DynamoDB lock table (see [Setup Guide](docs/setup.md))

## Quick Start

### 1. Configure local AWS credentials

```bash
cp config/deploy.env.example config/deploy.env
```

Edit `config/deploy.env` with AWS credentials (or `AWS_PROFILE`) and `AWS_REGION`.

### 2. Generate environment config and deploy

```bash
export TF_VAR_region=us-east-1
export TF_infra_env=dev
export TF_VAR_fcm_service_account_json='...'

./scripts/validate-state-backend.sh
./scripts/generate-env-config.sh
./scripts/terraform.sh plan
./scripts/terraform.sh apply
```

Generated config is written to gitignored `infra/terraform/configs/<region>/<env>/`.  
Terraform workspace: `{region}-{env}` (for example `us-east-1-dev`).

See [config/README.md](config/README.md) for details.

### 3. Save Terraform outputs

- `distribute_endpoint`
- `device_register_endpoint`
- `webhook_basic_auth_password`
- `device_api_key`

### 4. Build and publish Lambda code

```bash
./scripts/deploy-backend.sh
./scripts/jenkins-deploy-lambdas.sh   # if updating code on an existing stack
```

### 5. Configure Medallia

In your Medallia tenant:

1. Set the webhook URL to the Terraform `distribute_endpoint`
2. Configure HTTP Basic Auth using username `webhook-user` and the generated password
3. Run the auth check from the Medallia admin UI

### 6. Run the mobile app

```bash
cd mobile
cp .env.example .env
# Set EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_API_KEY
# Get google-services.json file from firebase instance (see example)
npm install
npm run ios   # or npm run android
```

Register the same `contact_id` Medallia uses when sending invitations.

### 7. Send a test webhook

```bash
chmod +x scripts/send-test-webhook.sh
./scripts/send-test-webhook.sh https://your-api.execute-api.us-east-1.amazonaws.com webhook-user your-password
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/distribute` | Medallia webhook receiver (Basic Auth) |
| `POST` | `/devices/register` | Mobile device registration (`x-api-key`) |
| `POST` | `/devices/delivery-ack` | Mobile delivery acknowledgement (`x-api-key`) |

## Status Lifecycle

| Status | When |
|--------|------|
| `delivery.queued` | Invitation accepted and enqueued (`202`) |
| `delivery.sent` | Push notification accepted by FCM |
| `delivery.delivered` | User opens the survey in the mobile app |
| `delivery.failed` | Device not registered, expired invitation, or push failure |

## Documentation

- [Setup Guide](docs/setup.md)
- [Deployment Config](config/README.md)
- [Jenkins CI/CD](docs/jenkins.md)
- [Architecture](docs/architecture.md)
- [Implementation Plan](docs/features/0001_PLAN.md)
- [Distribution Webhook OpenAPI](docs/api/distribute-v1_0_0.yaml)
- [Status Update OpenAPI](docs/api/status-v1_0_0.yaml)

## Security Considerations

This repository is a **reference implementation and demo**. The patterns below are
intentional simplifications to keep the codebase easy to follow. Production
deployments **must** address each area before serving real user data.

### Authentication and authorization

The device API endpoints (`/devices/register`, `/devices/delivery-ack`,
`/devices/{contactId}`) are protected by a single shared API key embedded in
the mobile app. **There is no per-user authentication or contact-ID ownership
verification.** Any client with the API key can register, delete, or
acknowledge deliveries for any contact ID.

**Production guidance:** Add per-user authentication (OAuth 2.0, one-time
verification codes, or identity-provider tokens) so that each user can only
manage their own device registrations.

### Callback URL validation

Status callbacks use an HTTPS-only allowlist that validates the **hostname**
of the callback URL (defaults to `*.medallia.com`). The hostname pattern is
configurable via the `CALLBACK_URL_ALLOWLIST` environment variable. This
prevents the OAuth bearer token from being sent to arbitrary URLs.

**Production guidance:** Restrict the allowlist to the exact callback
hostname(s) your Medallia tenant uses (e.g., `\.apis\.medallia\.com$`).

### Contact-ID hashing

Contact IDs are hashed before storage in DynamoDB. When the `HASH_HMAC_KEY`
environment variable is set, HMAC-SHA256 is used; otherwise the code falls
back to plain SHA-256 for backward compatibility.

**Production guidance:** Always configure an HMAC key so that stored hashes
cannot be reversed via rainbow tables. If migrating from plain SHA-256,
existing DynamoDB records must be re-hashed under the new key.

### Survey URL validation

The mobile app opens the survey URL from push notification data in a WebView
without restricting the URL to specific domains or schemes.

**Production guidance:** Validate that `surveyUrl` uses `https://` and
belongs to an expected survey domain before loading it in the WebView.

### Secrets management

Lambda functions read secrets from AWS Secrets Manager at cold start. The
Terraform configuration creates Secrets Manager entries for the webhook
password, device API key, FCM service account, and (optionally) Medallia
OAuth credentials.

### IAM roles

All Lambda functions currently share a single IAM execution role for
simplicity. The role grants DynamoDB, SQS, CloudWatch Logs, and Secrets
Manager access across all resources used by the project.

**Production guidance:** Create per-function IAM roles with least-privilege
policies so each Lambda can access only the resources it needs.

### Logging and PII

Structured logs redact sensitive fields (contact IDs, tokens, API keys,
survey URLs, callback URLs, and message content). The redaction list is
maintained in `backend/src/utils/logger.ts`.

### Git history and credentials

If you fork or mirror this repository, ensure that no real credentials exist
in the commit history. Rotate any secrets that may have been committed to
earlier revisions before making the repository public.

## AI-Assisted Integration

This repository includes an AI agent skill for planning integrations on
your own technology stack. Add this repo alongside your codebase in a
multi-root workspace and let the agent generate a stack-adapted
integration plan.

- **Integration guide**: [docs/ai-integration.md](docs/ai-integration.md)
- **Contract summary**: [docs/integration/contract-summary.md](docs/integration/contract-summary.md)
- **Cursor skill**: `.cursor/skills/integrate-distribution-webhook/SKILL.md`
- **Agent orientation**: [AGENTS.md](AGENTS.md)

The skill walks through a 5-phase workflow: Orient, Discover your stack,
Map responsibilities, Gap analysis, and Emit a phased implementation plan.

## License

This reference implementation is provided as sample code for client integrations. Review and adapt security, authentication, and operational practices before production use.
