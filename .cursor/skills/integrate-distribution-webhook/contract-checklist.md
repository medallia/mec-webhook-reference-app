# Contract Checklist — Medallia Distribution Webhook

## Core Contract Obligations

Every integration **must** satisfy these obligations. The "Scope" column
indicates whether the obligation is always required or conditional on the
delivery channel.

| ID | Obligation | Scope | Verify |
|----|-----------|-------|--------|
| O1 | **Webhook endpoint**: Accept `POST /distribute` with `application/cloudevents+json`. | Always | Endpoint exists and accepts CloudEvents. |
| O2 | **Inbound authentication**: Validate caller credentials (Basic Auth or OAuth 2.0). | Always | 401 returned for invalid/missing credentials. |
| O3 | **Auth-check handling**: Respond to `com.medallia.survey.invitation.authcheck` with `200` and `authcheck.success` CloudEvent. | Always | Auth-check returns correct type and source. |
| O4 | **Invitation validation**: Require `data.contact_id`, `data.survey_url`, `data.callback`, `data.expiration_timestamp`. Reject malformed requests with 400. | Always | Missing required fields return 400. |
| O5 | **Idempotency**: Deduplicate on CloudEvent `id`. Replay the original response for duplicate requests. | Always | Same `id` sent twice returns identical response. |
| O6 | **Async accept**: Return `202` with `delivery.queued` CloudEvent body. Do not block on delivery. | Always | Response returned before delivery attempt. |
| O7 | **Async delivery worker**: Process invitations asynchronously from a queue or equivalent. | Always | Separate process/thread handles delivery. |
| O8 | **Recipient lookup**: Resolve `contact_id` to a delivery target (device token, email address, etc.). | Always | Lookup mechanism exists for the delivery channel. |
| O9 | **Locale resolution**: Use `preferred_locale` and `messages[]` to select localized content. Graceful fallback when locale is missing. | Always | Correct message selected; defaults used when absent. |
| O10 | **Status callbacks**: POST `DistributionUpdate` CloudEvents to `data.callback` URL for `delivery.sent`, `delivery.failed`, `delivery.delivered`. Include `data.message_id` matching original `id`. | Always | All three status types posted with correct `message_id`. |
| O11 | **Device/recipient registration**: Client-side API to register delivery targets (device tokens, email addresses, etc.) keyed by `contact_id`. | Mobile/push | Registration endpoint exists. |
| O12 | **Delivery acknowledgement**: Mechanism to confirm the recipient engaged with the survey. Triggers `delivery.delivered` callback. | Mobile/push | Ack triggers callback to Medallia. |
| O13 | **Expired invitation handling**: Check `expiration_timestamp` before delivery. Reject expired invitations with `delivery.failed` (non-retryable, `INVITATION_EXPIRED`). | Always | Expired invitations rejected synchronously or in worker. |
| O14 | **Callback authentication**: Authenticate outbound status callbacks (OAuth 2.0 `Bearer` token or equivalent). | When configured | Token attached to callback requests. |

---

## Reference-Only Best Practices

These patterns are demonstrated in the reference app but **not required by
the Medallia contract**. Evaluate each for your production environment.

| ID | Practice | Reference File | Notes |
|----|----------|---------------|-------|
| R1 | Contact-ID hashing at rest (HMAC-SHA256) | `backend/src/utils/hash.ts` | Prevents PII in database. Requires key management. |
| R2 | PII log redaction | `backend/src/utils/logger.ts` | Recursive sanitisation of tokens, contact IDs, URLs, message content. |
| R3 | Timing-safe credential comparison | `backend/src/utils/auth.ts` | `crypto.timingSafeEqual` prevents timing attacks on auth. |
| R4 | Callback URL hostname allowlist (SSRF prevention) | `backend/src/services/statusCallback.ts` | Regex on `parsed.hostname` only — not the full URL. |
| R5 | Secrets Manager for all credentials | `backend/src/config.ts` | No plaintext secrets in environment variables. |
| R6 | Device deletion for privacy | `backend/src/handlers/deviceDelete.ts` | GDPR/CCPA: allow users to remove their data. |
| R7 | Dead-letter queue with alerting | `infra/terraform/sqs.tf` | Catches permanently failed messages. |
| R8 | Message TTL auto-purge | `backend/src/services/idempotency.ts` | 30-day TTL on DynamoDB message records. |

---

## Anti-Patterns

Flag these if found in the integrator's code or plan:

| Anti-Pattern | Why It's Wrong | Reference Counter-Example |
|-------------|---------------|--------------------------|
| **Sync push in webhook handler** | Blocks the 202 response; Medallia may timeout. Must process asynchronously. | `distribute.ts` enqueues to SQS, returns 202 immediately. |
| **No idempotency check** | Medallia may retry on timeout. Duplicate delivery and duplicate callbacks. | `idempotency.ts` uses DynamoDB conditional put on `messageId`. |
| **Missing `delivery.delivered` callback** | Medallia cannot close the invitation lifecycle. Survey may be re-sent. | `deliveryAck.ts` posts `DELIVERY_DELIVERED` on user survey open. |
| **Hardcoded callback URL** | Must use `data.callback` from each invitation. Different invitations may have different callback URLs. | `statusCallback.ts` reads URL from the invitation data. |
| **Copying AWS/Lambda/Expo wholesale** | Creates vendor lock-in and maintenance burden. Adapt the contract patterns, not the infrastructure. | This checklist separates contract from implementation. |
| **No callback URL validation** | SSRF risk: OAuth token sent to attacker-controlled URL if `data.callback` is manipulated. | `statusCallback.ts` validates hostname against allowlist. |
| **Android FCM: notification-type messages in foreground** | System tray shows duplicate notification + app cannot intercept. Use data-only messages for Android. | `pushService.ts` sends data-only for Android, notification+data for iOS. |
| **No background push handler registration** | Android kills the app; FCM messages are dropped silently. | `mobile/index.ts` imports `pushBackgroundHandler.ts` before mount. |
| **Plain SHA-256 for contact IDs** | Vulnerable to rainbow-table reversal. Use keyed HMAC if hashing PII. | `hash.ts` supports HMAC-SHA256 with Secrets Manager key. |
| **Logging raw invitation content** | PII exposure in logs (contact IDs, survey URLs, message bodies). | `logger.ts` redacts sensitive fields recursively. |
