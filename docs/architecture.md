# Architecture

This document describes the reference architecture for the Distribution Webhook mobile integration.

## Components

| Component | Responsibility |
|-----------|----------------|
| API Gateway | Public HTTPS entry point; routes to Lambda handlers |
| Distribute Lambda | Auth, CloudEvents validation, idempotency, async enqueue |
| SQS Queue | Async invitation processing with DLQ after 3 retries |
| Push Worker Lambda | Device lookup, locale resolution, FCM delivery, Medallia callbacks |
| Device Register Lambda | Stores `contact_id` → FCM token mappings |
| Device Delete Lambda | Removes device registrations (privacy/data deletion) |
| Delivery Ack Lambda | Sends `delivery.delivered` callbacks on survey open |
| DynamoDB `devices` | Device registration store (keyed by hashed contactId) |
| DynamoDB `messages` | Idempotency and callback metadata (30-day TTL) |
| React Native app | Registers device, receives push notifications, displays survey, acknowledges delivery |

## Inbound Webhook Flow

1. Medallia sends a CloudEvent to `POST /distribute`.
2. The distribute handler validates HTTP Basic Auth.
3. Auth-check events (`com.medallia.survey.invitation.authcheck`) return `authcheck.success` or `authcheck.error`.
4. Invitation events are checked for idempotency (CloudEvent `id`) and expiration.
5. Expired invitations are rejected synchronously with `delivery.failed` (`INVITATION_EXPIRED`, non-retryable).
6. New invitations are stored in DynamoDB and enqueued to SQS.
7. A `delivery.queued` response is returned with HTTP `202`.

## Push Worker Flow

1. SQS triggers the push worker Lambda.
2. The worker loads the device registration for `contact_id` (hashed lookup).
3. If no device is registered: posts `delivery.failed` callback, throws for SQS retry.
4. Localized invitation copy is resolved using `preferred_locale` and `messages[]` (exact locale → base-language → first message → English defaults).
5. FCM sends a push notification to the registered device token.
   - Android: data-only message for foreground control.
   - iOS: notification + data message with APNs priority 10.
6. The worker posts `delivery.sent` or `delivery.failed` to the invitation callback URL.

## Mobile Flow

1. The user enters a `contact_id` on the Register screen.
2. The app requests notification permissions and obtains the FCM device token.
3. The app calls `POST /devices/register` with `contactId`, `fcmToken`, and `platform`.
4. When a push arrives:
   - **Android background**: `setBackgroundMessageHandler` schedules a local notification.
   - **Android foreground**: FCM `onMessage` triggers a deduplicated local notification + in-app banner.
   - **iOS**: System notification displayed; tap opens the app.
5. When the user opens the survey, `App.tsx` navigates to `SurveyScreen` (WebView) and calls `acknowledgeDelivery(messageId)`.
6. The backend receives `POST /devices/delivery-ack` and posts `delivery.delivered` to Medallia.

## Device Deletion Flow

1. The user taps "Clear data" on the Home screen.
2. The app calls `DELETE /devices/{contactId}`.
3. The backend removes the device registration from DynamoDB.
4. Local storage (contact ID, push opt-in) is cleared.

## Status Lifecycle

```text
delivery.queued -> delivery.sent -> delivery.delivered
                 \-> delivery.failed
```

## Idempotency

Each invitation is keyed by the CloudEvent `id`. A DynamoDB conditional put (`attribute_not_exists(messageId)`) prevents duplicate processing. If Medallia retries the same message, the webhook returns the previously stored response body instead of enqueueing a duplicate job.

## Retry Policy

| Failure | Retryable | Behavior |
|---------|-----------|----------|
| Device not registered | Yes | `delivery.failed` callback, SQS retry (up to 3), then DLQ |
| FCM transient error | Yes | `delivery.failed` callback, SQS retry (up to 3), then DLQ |
| FCM permanent error | No | `delivery.failed` callback, message skipped |
| Invitation expired | No | Immediate `delivery.failed` response (sync, before enqueue) |
| Invalid payload | No | HTTP `400` |

## Security

| Concern | Implementation |
|---------|---------------|
| Inbound auth | HTTP Basic Auth with timing-safe comparison (`crypto.timingSafeEqual`) |
| Device API auth | Shared `x-api-key` with timing-safe comparison |
| Contact-ID storage | HMAC-SHA256 hashing at rest (key in Secrets Manager) |
| Credential storage | All secrets in AWS Secrets Manager (webhook password, API key, FCM SA, HMAC key, OAuth credentials) |
| Callback URL validation | HTTPS + hostname regex allowlist (defaults to `*.medallia.com`) |
| PII log redaction | Recursive sanitisation of contact IDs, tokens, URLs, message content in structured logs |
| Outbound callbacks | OAuth 2.0 client-credentials Bearer token (when configured) |

## API Routes

| Method | Path | Lambda | Auth |
|--------|------|--------|------|
| `POST` | `/distribute` | distribute | HTTP Basic Auth |
| `POST` | `/devices/register` | device-register | `x-api-key` |
| `DELETE` | `/devices/{contactId}` | device-delete | `x-api-key` |
| `POST` | `/devices/delivery-ack` | delivery-ack | `x-api-key` |

## Extension Points

- OAuth 2.0 inbound webhook auth (in addition to Basic Auth)
- Multiple devices per `contact_id`
- Opt-out UI that sends `delivery.optout`
- Per-function IAM roles (least privilege)
- Real identity provider integration (replace shared API key)
- Email/SMS as alternative delivery channels

## Related Documentation

- [Contract Summary](integration/contract-summary.md) — Medallia contract vs reference choices
- [AI Integration Guide](ai-integration.md) — using AI agents to plan your integration
- [Setup Guide](setup.md) — deployment and configuration
- [OpenAPI Specs](api/) — formal API contracts
