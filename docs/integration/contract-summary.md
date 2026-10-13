# Medallia Distribution Webhook — Contract Summary

This document separates the **Medallia contract obligations** (what every
integration must satisfy) from the **reference implementation choices** (how
this particular repository fulfils them). Use it as a checklist when
building your own integration on a different stack.

> **OpenAPI specs:**
> [distribute-v1\_0\_0.yaml](../api/distribute-v1_0_0.yaml) (inbound) |
> [status-v1\_0\_0.yaml](../api/status-v1_0_0.yaml) (outbound)
>
> **Test fixtures:**
> [distribution-request.json](../../backend/tests/fixtures/distribution-request.json) |
> [auth-check-request.json](../../backend/tests/fixtures/auth-check-request.json) |
> [distribution-update-queued.json](../../backend/tests/fixtures/distribution-update-queued.json) |
> [distribution-update-failed-retryable.json](../../backend/tests/fixtures/distribution-update-failed-retryable.json)

---

## 1. Inbound Webhook (`POST /distribute`)

| Contract Requirement | Reference Choice |
|----------------------|------------------|
| Accept `application/cloudevents+json` POST requests at a single endpoint. | AWS API Gateway HTTP API route → Lambda `distribute` handler. |
| Authenticate the caller. OpenAPI allows OAuth 2.0 client-credentials **or** HTTP Basic Auth. | HTTP Basic Auth validated in-handler (`backend/src/utils/auth.ts`). |
| Handle **auth-check** events (`com.medallia.survey.invitation.authcheck`): return `200` with `authcheck.success` or `authcheck.error` CloudEvent. | Detected via `isAuthCheckRequest()`, responds synchronously. |
| Handle **invitation** events (`com.medallia.survey.invitation`) with required `data` fields: `record_type`, `survey_id`, `survey_url`, `contact_id`, `expiration_timestamp`, `callback`. | Validated in handler; missing fields → 400. |
| Optional fields: `preferred_locale`, `messages[]` (each with `locale`, `summary`, `details`/`content`), `additional_data`, `traceparent`. | Stored and forwarded; locale resolved in worker via `resolveInvitationMessage()`. |
| Return `202` with `delivery.queued` CloudEvent body for accepted invitations. | DynamoDB record created, SQS message enqueued, 202 returned with `DistributionUpdate` body. |
| Reject expired invitations synchronously: return `200` with `delivery.failed` (`INVITATION_EXPIRED`, non-retryable). | `isInvitationExpired()` check before enqueue. |
| Enforce **idempotency** on CloudEvent `id`. Replay the original response for duplicates. | DynamoDB conditional put on `messageId` (`attribute_not_exists`). Stored `responseBody` replayed on collision. |
| Propagate `traceparent` from inbound event to all outbound updates for the same invitation. | Stored in SQS `QueueMessage` and forwarded to status callbacks. |

---

## 2. Asynchronous Delivery

| Contract Requirement | Reference Choice |
|----------------------|------------------|
| Process invitations asynchronously (webhook returns 202 before delivery). | SQS queue between `distribute` and `pushWorker` Lambdas. |
| Look up recipient by `contact_id`. | DynamoDB `devices` table keyed by hashed `contact_id` (`deviceRegistry.getDeviceByContactId`). |
| Deliver the survey invitation to the recipient via the integrator's channel. | Firebase Cloud Messaging push notification with `surveyUrl`, `messageId`, localized `title`/`body` in payload. |
| Resolve localized content from `preferred_locale` and `messages[]`. | `resolveInvitationMessage()`: exact locale → base-language prefix → first message → English defaults. |
| Handle delivery failures with retry semantics. | Retryable FCM errors → throw (SQS re-delivers up to 3 times, then DLQ). Non-retryable → `continue`. |

---

## 3. Outbound Status Callbacks

| Contract Requirement | Reference Choice |
|----------------------|------------------|
| POST `DistributionUpdate` CloudEvent to the `callback` URL from the invitation. | `postStatusCallback()` in `statusCallback.ts`. |
| Content-Type: `application/cloudevents+json`. | Set on all callback requests. |
| `data.message_id` must match the original CloudEvent `id`. | Stored at enqueue time and forwarded through the pipeline. |
| `source`: `urn:client:webhook`. | Constant `CLIENT_SOURCE`. |
| Authenticate with OAuth 2.0 client-credentials `Bearer` token when configured. | In-memory token cache with 30-second skew refresh. |
| Report these status transitions: | |
| — `delivery.queued` | Returned inline in the 202 response body. |
| — `delivery.sent` | Posted after FCM accepts the push notification. |
| — `delivery.failed` (with `error.code`, `error.message`, `error.retryable`) | Posted on device-not-found, expired, or FCM failure. Retryable flag set per error type. |
| — `delivery.delivered` | Posted when mobile app calls `POST /devices/delivery-ack`. |
| — `delivery.optout` (optional) | Type defined but not currently emitted by the reference app. |
| Validate callback URL before sending credentials (SSRF prevention). | HTTPS + hostname regex allowlist (defaults to `*.medallia.com`). |
| Medallia responds with `DistributionUpdateResponse` (`updatesuccess` or `updateerror`). | Response parsed and logged; `updateerror` does not trigger retry. |

---

## 4. Client-Owned Device APIs

These endpoints are **not part of the Medallia contract** — they are the
client's own APIs for managing the delivery channel. The reference app
implements them for the mobile push notification use case.

| Endpoint | Auth | Purpose | Reference Handler |
|----------|------|---------|-------------------|
| `POST /devices/register` | `x-api-key` | Register a device (FCM token + platform + contactId) for push delivery. | `deviceRegister.ts` |
| `DELETE /devices/{contactId}` | `x-api-key` | Remove a device registration (privacy/data-deletion). | `deviceDelete.ts` |
| `POST /devices/delivery-ack` | `x-api-key` | Acknowledge that the user opened the survey; triggers `delivery.delivered` callback. | `deliveryAck.ts` |

---

## 5. Event Type Catalogue

| Event Type | Direction | When |
|------------|-----------|------|
| `com.medallia.survey.invitation.authcheck` | Inbound | Medallia validates credentials. |
| `com.medallia.survey.invitation` | Inbound | New survey invitation to distribute. |
| `com.medallia.survey.invitation.authcheck.success` | Outbound (inline) | Auth-check passed. |
| `com.medallia.survey.invitation.authcheck.error` | Outbound (inline) | Auth-check failed. |
| `com.medallia.survey.invitation.delivery.queued` | Outbound (inline 202) | Invitation accepted for async processing. |
| `com.medallia.survey.invitation.delivery.sent` | Outbound (callback) | Delivery channel accepted the invitation. |
| `com.medallia.survey.invitation.delivery.failed` | Outbound (inline or callback) | Delivery failed (with error detail). |
| `com.medallia.survey.invitation.delivery.delivered` | Outbound (callback) | Recipient engaged with the survey. |
| `com.medallia.survey.invitation.delivery.optout` | Outbound (callback) | Recipient opted out (not implemented in reference). |
| `com.medallia.survey.invitation.delivery.updatesuccess` | Medallia ACK | Medallia accepted the status update. |
| `com.medallia.survey.invitation.delivery.updateerror` | Medallia ACK | Medallia rejected the status update. |

---

## 6. Reference-Only Patterns

These are implementation best practices demonstrated by the reference app but
**not required by the Medallia contract**. Adopt or adapt to your stack.

| Pattern | Reference Location | Notes |
|---------|--------------------|-------|
| Contact-ID hashing at rest (HMAC-SHA256) | `backend/src/utils/hash.ts` | Prevents PII storage in DynamoDB. Key stored in Secrets Manager. |
| PII log redaction | `backend/src/utils/logger.ts` | Recursive sanitisation of sensitive fields in structured logs. |
| Timing-safe credential comparison | `backend/src/utils/auth.ts` | `crypto.timingSafeEqual` for Basic Auth and API key validation. |
| Callback URL hostname allowlist | `backend/src/services/statusCallback.ts` | Regex validated against `new URL(url).hostname` only. |
| Secrets Manager for all credentials | `backend/src/config.ts` | Webhook password, API key, FCM SA, HMAC key, OAuth credentials. |
| Device deletion for privacy | `backend/src/handlers/deviceDelete.ts` | Allows users to remove their registration data. |
| Dead-letter queue with CloudWatch alarm | `infra/terraform/sqs.tf` | Catches messages that exceed the retry limit. |
| Message TTL (30 days) | `backend/src/services/idempotency.ts` | DynamoDB TTL auto-purges old message records. |

---

## 7. Invitation Data Fields Reference

Derived from `DistributionRequest.data` in the OpenAPI spec and
`InvitationData` in `backend/src/models/cloudevents.ts`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `record_type` | `"live" \| "preview"` | Yes | Indicates live traffic or test preview. |
| `survey_id` | `string` | Yes | Medallia internal survey record ID. |
| `survey_url` | `string (URI)` | Yes | URL that engages the recipient with the survey. |
| `contact_id` | `string` | Yes | Unique identifier for the contact (email, loyalty number, etc.). |
| `expiration_timestamp` | `string (date-time)` | Yes | After this time the invitation is expired. |
| `callback` | `string (URI)` | Yes | Medallia URL for status update callbacks. |
| `preferred_locale` | `string` | No | BCP 47 locale code for the recipient. |
| `messages` | `InvitationMessage[]` | No | Localized message variants (locale, summary, details/content). |
| `additional_data` | `object` | No | Extra metadata (e.g. `masked_url`). |

---

## 8. Locale Resolution Algorithm

From `backend/src/utils/locale.ts` — `resolveInvitationMessage()`:

1. If `preferred_locale` is set, find an exact match in `messages[]`.
2. If no exact match, find a base-language prefix match (e.g. `en-US` → `en`).
3. If still no match but `messages[]` is non-empty, use the first message.
4. If `messages[]` is empty or absent, use English defaults:
   - summary: "We'd love your feedback"
   - details: "Thank you for your recent experience. Would you take a moment to share your feedback?"
5. Return `{ locale, summary, details }`.

The `details` field falls back to `content` if `details` is absent (Medallia
broadcaster may send long-form copy as `content`).
