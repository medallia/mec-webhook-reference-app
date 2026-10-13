# Setup Guide

Follow these steps to deploy and test the reference implementation.

## 1. Firebase Setup

1. Create a Firebase project.
2. Enable Cloud Messaging.
3. For iOS, upload your APNs key or certificate in the Firebase console.
4. Create a service account and download the JSON key.
5. Provide the JSON when generating Terraform config (see step 3 below).

For the mobile app:

1. Add an iOS and/or Android app in Firebase.
2. Download `GoogleService-Info.plist` or `google-services.json`.
3. Place Android config at `mobile/google-services.json` (see `mobile/google-services.json.example`).
4. Place iOS config at `mobile/GoogleService-Info.plist` and copy the same file to `mobile/ios/WebhookInvitesDemo/GoogleService-Info.plist` (see `mobile/GoogleService-Info.plist.example`). These paths are gitignored.
5. Configure Expo/EAS credentials for device builds.

## 2. Terraform remote state prerequisites

This project uses a shared S3 backend defined in [`infra/terraform/terraform.tf`](../infra/terraform/terraform.tf):

| Resource | Name |
|----------|------|
| S3 bucket | `medallia-webhook-demo-terraform-state-storage-s3` |
| DynamoDB lock table | `medallia-webhook-demo-terraform-state-lock-dynamo` |
| Lock hash key | `LockID` |

These resources must exist before deploying. Validate access:

```bash
cp config/deploy.env.example config/deploy.env
# edit config/deploy.env
./scripts/validate-state-backend.sh
```

State is isolated per environment using Terraform workspaces named `{region}-{env}`.

## 3. Configure local deployment settings

```bash
cp config/deploy.env.example config/deploy.env
```

Edit `config/deploy.env` with AWS credentials (or `AWS_PROFILE`) and `AWS_REGION`.

Generate per-environment Terraform config:

```bash
export TF_VAR_region=us-east-1
export TF_infra_env=dev
export TF_VAR_fcm_service_account_json='...'

./scripts/generate-env-config.sh
```

This writes gitignored files to:

- `infra/terraform/configs/us-east-1/dev/config.tfvars`
- `infra/terraform/configs/us-east-1/dev/secrets.auto.tfvars`

Optional OAuth values:

```bash
export TF_VAR_medallia_oauth_token_url='...'
export TF_VAR_medallia_oauth_client_id='...'
export TF_VAR_medallia_oauth_client_secret='...'
```

## 4. Deploy AWS infrastructure

```bash
./scripts/terraform.sh plan
./scripts/terraform.sh apply
```

Capture these outputs:

- `distribute_endpoint`
- `device_register_endpoint`
- `delivery_ack_endpoint`
- `webhook_basic_auth_password`
- `device_api_key`

## 5. Publish Backend Code

```bash
./scripts/deploy-backend.sh
```

If you deployed before building bundles, update each Lambda function with the matching zip from `backend/dist/lambda/`:

- `distribute.zip`
- `pushWorker.zip`
- `deviceRegister.zip`
- `deviceDelete.zip`
- `deliveryAck.zip`

Or run `./scripts/jenkins-deploy-lambdas.sh` if AWS CLI is configured.

The push worker bundle includes the Firebase Admin SDK.

## 6. Configure Medallia

1. Open your Medallia Distribution Webhook configuration.
2. Set the webhook URL to the Terraform `distribute_endpoint`.
3. Configure HTTP Basic Auth:
   - Username: `webhook-user`
   - Password: Terraform output `webhook_basic_auth_password`
4. Run the auth check from the Medallia admin UI.

Optional outbound status callback auth:

- Set `TF_VAR_medallia_oauth_*` when running `generate-env-config.sh`
- Re-run `./scripts/generate-env-config.sh` and `./scripts/terraform.sh apply`

## 7. Configure and Run the Mobile App

```bash
cd mobile
cp .env.example .env
```

Set:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-api.execute-api.us-east-1.amazonaws.com
EXPO_PUBLIC_API_KEY=your-device-api-key
```

Install and run:

```bash
npm install
npm run ios
# or
npm run android
```

In the app:

1. Enter the same `contact_id` Medallia will use in distributions.
2. Accept notification permissions.
3. Confirm registration succeeds on the home screen.

## 8. End-to-End Test

```bash
chmod +x scripts/send-test-webhook.sh
./scripts/send-test-webhook.sh \
  https://your-api.execute-api.us-east-1.amazonaws.com \
  webhook-user \
  your-webhook-password
```

Verify:

1. Distribute Lambda logs show `delivery.queued`
2. Push worker logs show `delivery.sent` or a actionable failure
3. The mobile device receives a notification
4. Opening the survey triggers `delivery.delivered`

## State migration (existing deployments)

If you previously used key-based state files instead of workspaces:

1. Back up existing state
2. Run `./scripts/generate-env-config.sh`
3. Run `./scripts/terraform.sh init` and create/select workspace `{region}-{env}`
4. Migrate state with `terraform init -migrate-state` or manual `state pull`/`push` as needed

## Troubleshooting

| Symptom | Likely Cause |
|---------|--------------|
| Auth check fails | Basic Auth mismatch between Medallia and Terraform output |
| `DEVICE_NOT_REGISTERED` | Mobile app has not registered the same `contact_id` |
| No push on iOS | APNs not configured in Firebase or app built without push entitlements |
| Callback failures | Missing Medallia OAuth credentials for outbound status updates |
| Messages in DLQ | Repeated push failures or unregistered device with retryable errors |
| Terraform backend errors | Run `./scripts/validate-state-backend.sh` and verify bucket/table access |

## Operational Notes

- Monitor the push DLQ CloudWatch alarm.
- Rotate webhook and device API credentials regularly.
- Use separate workspaces per environment (for example `us-east-1-dev` vs `us-east-1-prod`).
