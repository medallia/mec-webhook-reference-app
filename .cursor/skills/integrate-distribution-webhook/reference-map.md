# Reference Map — Obligation to Code

Every file path below has been verified against the current branch. Use this
map to find the reference implementation of each contract obligation and
best practice.

---

## Core Obligations

| ID | Obligation | Reference File(s) | Key Symbols |
|----|-----------|-------------------|-------------|
| O1 | Webhook endpoint (`POST /distribute`) | `backend/src/handlers/distribute.ts` | `handler()` — API Gateway proxy handler |
| | | `infra/terraform/api_gateway.tf` | `aws_apigatewayv2_route.distribute` — `POST /distribute` |
| O2 | Inbound authentication | `backend/src/utils/auth.ts` | `validateBasicAuth()`, `parseBasicAuthHeader()`, `safeEqual()` |
| | | `backend/src/config.ts` | `webhookUsername`, `webhookPassword` read from Secrets Manager |
| O3 | Auth-check handling | `backend/src/handlers/distribute.ts` | `isAuthCheckRequest()` branch → `buildAuthCheckResponse()` |
| | | `backend/src/utils/cloudevents.ts` | `buildAuthCheckResponse()` — constructs `authcheck.success` CloudEvent |
| | | `backend/src/models/cloudevents.ts` | `AuthCheckRequest`, `AuthCheckResponse`, `EventTypes.AUTH_CHECK_SUCCESS` |
| O4 | Invitation validation | `backend/src/handlers/distribute.ts` | Field checks: `contact_id`, `survey_url`, `callback` required; 400 on missing |
| | | `backend/src/utils/cloudevents.ts` | `validateCloudEventEnvelope()` — requires `specversion`, `id`, `source`, `type` |
| O5 | Idempotency | `backend/src/services/idempotency.ts` | `getProcessedMessage()`, `createQueuedMessage()` — conditional DynamoDB put on `messageId` |
| | | `backend/src/models/messageRecord.ts` | `ProcessedMessage`, `MESSAGE_TTL_SECONDS` (30 days) |
| O6 | Async accept (202 + `delivery.queued`) | `backend/src/handlers/distribute.ts` | SQS `SendMessageCommand` → `jsonResponse(202, queuedUpdate)` |
| | | `backend/src/utils/cloudevents.ts` | `buildDistributionUpdate()` — constructs `DistributionUpdate` with `delivery.queued` type |
| O7 | Async delivery worker | `backend/src/handlers/pushWorker.ts` | `handler()` — SQS-triggered Lambda, processes each `QueueMessage` |
| | | `infra/terraform/sqs.tf` | `aws_sqs_queue.push` — visibility 60s, DLQ after 3 retries |
| | | `infra/terraform/lambda.tf` | `aws_lambda_event_source_mapping.push_worker` |
| O8 | Recipient lookup | `backend/src/services/deviceRegistry.ts` | `getDeviceByContactId()` — DynamoDB get by hashed `contactId` |
| | | `backend/src/models/device.ts` | `DeviceRegistration` — `contactId`, `fcmToken`, `platform` |
| O9 | Locale resolution | `backend/src/utils/locale.ts` | `resolveInvitationMessage()` — preferred → base-lang → first → defaults |
| | | | `isInvitationExpired()` — used in distribute handler |
| O10 | Status callbacks | `backend/src/services/statusCallback.ts` | `postStatusCallback()` — POST CloudEvent to `callback` URL |
| | | | `validateCallbackUrl()` — HTTPS + hostname regex |
| | | | `getOAuthToken()` — client-credentials with cache |
| | | `backend/src/utils/cloudevents.ts` | `buildDistributionUpdate()` — builds `DistributionUpdate` for any status type |
| O11 | Device registration | `backend/src/handlers/deviceRegister.ts` | `handler()` — `POST /devices/register` |
| | | `backend/src/services/deviceRegistry.ts` | `upsertDevice()` — DynamoDB put with hashed `contactId` |
| | | `mobile/src/services/api.ts` | `registerDevice()` — client-side POST with FCM token |
| O12 | Delivery acknowledgement | `backend/src/handlers/deliveryAck.ts` | `handler()` — `POST /devices/delivery-ack`, updates to `DELIVERY_DELIVERED` + callback |
| | | `mobile/App.tsx` | `acknowledgeDelivery(messageId)` — called after survey navigation |
| O13 | Expired invitation handling | `backend/src/handlers/distribute.ts` | `isInvitationExpired()` check → sync 200 `DELIVERY_FAILED` (`INVITATION_EXPIRED`, non-retryable) |
| O14 | Callback authentication (OAuth) | `backend/src/services/statusCallback.ts` | `getOAuthToken()` — OAuth client-credentials, `Authorization: Bearer` header |
| | | `backend/src/config.ts` | `oauthTokenUrl`, `oauthClientId`, `oauthClientSecret` from Secrets Manager |

---

## Reference-Only Best Practices

| ID | Practice | Reference File(s) | Key Symbols |
|----|----------|-------------------|-------------|
| R1 | Contact-ID hashing | `backend/src/utils/hash.ts` | `hashContactId()` — HMAC-SHA256 (keyed) or SHA-256 (fallback) |
| | | | `initHmacKeyFromSecret()` — initialises key from Secrets Manager |
| R2 | PII log redaction | `backend/src/utils/logger.ts` | `REDACT_KEYS` set, `sanitize()` recursive function, `logger` object |
| R3 | Timing-safe auth | `backend/src/utils/auth.ts` | `safeEqual()` — buffer-padded `timingSafeEqual` + length check |
| R4 | Callback URL validation | `backend/src/services/statusCallback.ts` | `ALLOWED_HOSTNAME_PATTERN`, `validateCallbackUrl()` on `parsed.hostname` |
| R5 | Secrets Manager | `backend/src/config.ts` | `getSecretString()`, `getSecretJson()` — reads ARNs from env vars |
| R6 | Device deletion | `backend/src/handlers/deviceDelete.ts` | `handler()` — `DELETE /devices/{contactId}` |
| | | `backend/src/services/deviceRegistry.ts` | `deleteDevice()` — DynamoDB delete by hashed contactId |
| R7 | Dead-letter queue | `infra/terraform/sqs.tf` | `aws_sqs_queue.push_dlq`, `aws_cloudwatch_metric_alarm.push_dlq_alarm` |
| R8 | Message TTL | `backend/src/services/idempotency.ts` | `MESSAGE_TTL_SECONDS` (30 days), `ttl` attribute on DynamoDB items |

---

## Mobile Push Flow

| Step | Reference File(s) | Key Symbols |
|------|-------------------|-------------|
| FCM push send | `backend/src/services/pushService.ts` | `sendPushNotification()` — Android: data-only; iOS: notification+data |
| Background handler (Android) | `mobile/src/services/pushBackgroundHandler.ts` | `setBackgroundMessageHandler()` → `handleAndroidBackgroundRemoteMessage()` |
| Foreground handler (Android) | `mobile/src/services/pushForegroundAndroid.ts` | `deliverAndroidForegroundInvitation()` — dedupe + local notification |
| | `mobile/src/services/pushMessagingBootstrap.ts` | `ensureAndroidForegroundPushHandlers()` — wires FCM `onMessage` |
| Push payload extraction | `mobile/src/services/pushPayload.ts` | `extractInvitationFromRemoteMessage()`, `PushInvitation` type |
| Local notification scheduling | `mobile/src/services/pushPresentation.ts` | `presentInvitationFromPushInvitation()`, `ANDROID_NOTIFICATION_CHANNEL_ID` |
| Foreground banner | `mobile/src/components/ForegroundInvitationBanner.tsx` | Subscribes to `ANDROID_FOREGROUND_PUSH_EVENT` |
| Survey display | `mobile/src/screens/SurveyScreen.tsx` | WebView loads `surveyUrl` from navigation params |
| Delivery ack (client) | `mobile/App.tsx` | `acknowledgeDelivery(messageId)` after navigate to Survey |
| Delivery ack (API) | `mobile/src/services/api.ts` | `acknowledgeDelivery()` — `POST /devices/delivery-ack` |
| Device registration | `mobile/src/screens/RegisterScreen.tsx` | Contact ID + consent → FCM token → `registerDevice()` |
| | `mobile/src/services/api.ts` | `registerDevice()` — `POST /devices/register` |
| Device deletion | `mobile/src/screens/HomeScreen.tsx` | "Clear data" → `deleteDevice()` + `clearAllData()` |
| Push diagnostics (Android) | `mobile/src/services/pushDiagnostics.ts` | Ring buffer, gesture unlock |
| | `mobile/src/components/PushDiagnosticsPanel.tsx` | Debug UI component |

---

## Infrastructure (Reference Only)

These are AWS-specific choices. Do **not** recommend copying them unless the
integrator is on AWS.

| Component | Reference File | Resource / Config |
|-----------|---------------|-------------------|
| API Gateway | `infra/terraform/api_gateway.tf` | HTTP API, `$default` stage, 20 rps / 50 burst |
| Lambda functions (5) | `infra/terraform/lambda.tf` | distribute, push-worker, device-register, device-delete, delivery-ack |
| SQS queue + DLQ | `infra/terraform/sqs.tf` | 60s visibility, 3 retries, DLQ alarm |
| DynamoDB tables | `infra/terraform/dynamodb.tf` | `devices` (PK: contactId), `messages` (PK: messageId, TTL) |
| Secrets Manager | `infra/terraform/secrets.tf` | Webhook auth, device API key, FCM SA, HMAC key, OAuth creds |
| IAM role | `infra/terraform/iam.tf` | Shared role: logs, DynamoDB, SQS, Secrets Manager |
| CloudWatch logs | `infra/terraform/cloudwatch.tf` | Per-Lambda log groups with configurable retention |
