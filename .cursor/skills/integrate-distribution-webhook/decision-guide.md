# Decision Guide — Adapting the Reference to Your Stack

This guide helps you translate reference implementation choices into your
own technology stack. For each infrastructure concern, we describe what the
**contract requires**, what the **reference chose**, and how to **adapt**.

---

## 1. Server Framework

| | |
|---|---|
| **Contract** | A single `POST /distribute` endpoint that accepts CloudEvents JSON. |
| **Reference** | AWS API Gateway + Lambda (Node.js / TypeScript). |
| **Adapt** | Any HTTP framework works: Spring Boot, ASP.NET, Express, FastAPI, Go net/http, Rails, etc. The handler logic is the same regardless of framework. |

**Key patterns to preserve:**
- Parse CloudEvent envelope fields (`specversion`, `id`, `source`, `type`)
- Branch on `type`: auth-check vs invitation
- Return CloudEvent JSON responses with correct `Content-Type`

---

## 2. Message Queue / Async Processing

| | |
|---|---|
| **Contract** | Invitations must be processed asynchronously (return 202 before delivery). |
| **Reference** | SQS with a separate Lambda consumer. DLQ after 3 failed attempts. |
| **Adapt** | RabbitMQ, Kafka, Azure Service Bus, Google Pub/Sub, Redis Streams, Celery, Sidekiq, or even a database-backed job table. |

**Key patterns to preserve:**
- Enqueue immediately after idempotency check
- Worker retries on transient failures (retryable errors)
- Dead-letter / poison-message handling for permanent failures
- Visibility timeout long enough for delivery + callback

---

## 3. Database / Storage

| | |
|---|---|
| **Contract** | Store recipient registrations (keyed by `contact_id`) and track message state for idempotency and status. |
| **Reference** | DynamoDB: `devices` table (PK: hashed contactId) + `messages` table (PK: messageId, TTL). |
| **Adapt** | PostgreSQL, MySQL, MongoDB, Redis, Firestore, SQL Server, etc. |

**Key patterns to preserve:**
- Idempotency: conditional insert / upsert on `messageId` (e.g. `INSERT ... ON CONFLICT DO NOTHING`)
- Store the original response body for replay on duplicate
- Message TTL or scheduled cleanup (30 days in reference)
- Contact-ID hashing if storing PII

---

## 4. Push / Delivery Provider

| | |
|---|---|
| **Contract** | Deliver the survey invitation to the recipient via your chosen channel. |
| **Reference** | Firebase Cloud Messaging (FCM) for mobile push notifications. |
| **Adapt** | APNs directly, OneSignal, Twilio (SMS), SendGrid/SES (email), or any channel. |

**Key patterns to preserve:**
- Include `surveyUrl` and `messageId` in the delivery payload
- Include localized title/body from `resolveInvitationMessage()`
- Distinguish retryable vs permanent delivery failures
- Report `delivery.sent` on success, `delivery.failed` on failure

### Email as delivery channel (server-only integrations)

If mobile is out of scope, email is the natural alternative:

1. Resolve recipient email from `contact_id` (may already be the email)
2. Build an email with localised content from `messages[]`
3. Include `survey_url` as a clickable link
4. Track opens via email open-tracking pixel or link-click tracking
5. On click/open: post `delivery.delivered` callback
6. Bounce/reject: post `delivery.failed` with appropriate error

The reference app does not implement email delivery, but the contract
obligations (O6–O10, O13–O14) apply identically.

---

## 5. Mobile Platform

| | |
|---|---|
| **Contract** | Not specified — mobile is one delivery channel option. |
| **Reference** | React Native (Expo) with Firebase Messaging. iOS + Android. |
| **Adapt** | Native iOS (Swift), Native Android (Kotlin), Flutter, Xamarin, PWA, etc. |

**Key patterns to preserve:**
- Register device token + contact ID with the backend
- Handle push notifications in both foreground and background
- Open survey URL (WebView or system browser)
- Acknowledge delivery by posting back to the backend

**Platform-specific notes:**
- **Android**: Use data-only FCM messages for foreground control. Register a background handler before the app mounts.
- **iOS**: APNs via FCM or direct. Handle notification tap from killed state (e.g. `getInitialNotification` or `UNUserNotificationCenter` delegate).
- **Flutter**: `firebase_messaging` package. Background handler via `FirebaseMessaging.onBackgroundMessage`.
- **Native Android (Kotlin)**: `FirebaseMessagingService.onMessageReceived`. Use `WorkManager` for reliable background processing.

---

## 6. Authentication

| | |
|---|---|
| **Contract** | Inbound: Basic Auth or OAuth 2.0. Outbound callbacks: OAuth 2.0 Bearer token. |
| **Reference** | Inbound: Basic Auth. Outbound: OAuth client-credentials with token cache. |
| **Adapt** | Use whatever auth your infrastructure supports. |

**Key patterns to preserve:**
- Timing-safe comparison for credential validation
- Token caching with expiry-aware refresh for outbound OAuth
- Never send OAuth tokens to unvalidated callback URLs

---

## 7. Partial Implementation Scenarios

### Existing webhook, no Medallia handler

You already receive webhooks from other systems.

**What to add:**
- CloudEvents parsing on the existing endpoint (or a new `/distribute` route)
- Auth-check handling (O3)
- Invitation validation + idempotency (O4, O5)
- Async enqueue + 202 response (O6)
- Worker: recipient lookup + delivery + status callbacks (O7–O10, O13–O14)

**What to reuse:** Your existing webhook auth, queue, database, deployment.

### Existing push notification service, no webhook

You already send push notifications but don't have a Medallia webhook.

**What to add:**
- `POST /distribute` endpoint with CloudEvents + auth (O1–O6)
- Bridge from queue to your existing push service (O7)
- Status callback posting (O10, O14)
- Idempotency layer (O5)

**What to reuse:** Your push service, device registry, mobile app.

### No mobile — email or SMS only

Mobile obligations O11 and O12 are **N/A**.

**What to add:**
- Everything in O1–O10, O13–O14
- Email/SMS sending in the async worker
- Delivery tracking (open/click → `delivery.delivered`)

**What to skip:** Device registration, FCM/APNs, mobile UI.

### Existing Medallia integration — adding Distribution Webhook

You already integrate with Medallia but via a different channel.

**What to add:**
- The webhook endpoint (O1–O6)
- Async worker bridging to your existing delivery (O7–O10)
- Status callbacks (O10, O14) — may require new OAuth credentials

**What to reuse:** Your existing delivery infrastructure, contact database,
authentication.
