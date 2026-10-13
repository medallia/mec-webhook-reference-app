# Scenario 3: Server-Only — Node.js + Email Delivery

## Integrator Profile

- **Backend**: Node.js (Express), PostgreSQL, Bull (Redis-backed job queue)
- **Mobile**: None (server-only, email delivery)
- **Email Provider**: SendGrid
- **Auth**: Express middleware (can do Basic Auth)
- **Deployment**: Docker on AWS ECS
- **Existing webhook**: None
- **Existing email service**: `EmailService` class that sends templated emails via SendGrid with open/click tracking

## Stub File Layout

```
my-email-app/
  package.json
  src/
    app.ts
    routes/
      health.ts
    middleware/
      auth.ts
    services/
      EmailService.ts         ← existing SendGrid sender with tracking
      UserService.ts
    models/
      User.ts
    db/
      migrations/
      connection.ts
    jobs/
      worker.ts               ← existing Bull worker
      queues.ts
    config.ts
  docker-compose.yml
  Dockerfile
```

## Prompt

> "I have a Node.js Express backend with PostgreSQL and Bull queues.
> I deliver notifications via email using SendGrid. I have no mobile app.
> I need to integrate with Medallia's Distribution Webhook to deliver
> survey invitations via email. Using the reference implementation,
> create an integration plan. Mobile is out of scope."

## Answer Key

### Expected Stack Profile

| Concern | Expected Mapping |
|---------|-----------------|
| Server Framework | Express.js — new `/distribute` route |
| Queue | Bull (Redis) — new queue for invitation processing |
| Database | PostgreSQL — new tables for messages (idempotency) |
| Delivery Provider | Existing `EmailService` (SendGrid) |
| Mobile | N/A |
| Auth (Inbound) | Express middleware Basic Auth |
| Auth (Outbound) | `fetch` / `axios` with OAuth client-credentials |

### Expected Obligation Mappings

| ID | Expected Integrator Component |
|----|------------------------------|
| O1 | New Express route `POST /distribute` |
| O2 | Auth middleware (Basic Auth) |
| O3 | Branch on CloudEvent `type` |
| O4 | Request body validation (Joi, Zod, or manual) |
| O5 | PostgreSQL `INSERT ... ON CONFLICT(message_id) DO NOTHING` |
| O6 | Bull `queue.add()`, return 202 |
| O7 | Bull worker processor (`worker.ts` extended or new file) |
| O8 | `UserService.findByContactId()` — resolve email address from contact |
| O9 | Locale resolution (port from reference `locale.ts`) |
| O10 | New callback service using `fetch` with OAuth Bearer |
| O11 | **N/A** — no mobile, no device registration |
| O12 | **N/A** — or email open/click tracking → `delivery.delivered` |
| O13 | Expiration check in route or worker |
| O14 | OAuth 2.0 client-credentials with token caching |

### Expected Gaps

| ID | Status | Reason |
|----|--------|--------|
| O1 | Missing | No webhook endpoint exists |
| O2 | Partial | Auth middleware exists but not configured for Basic Auth |
| O3–O7 | Missing | No Medallia-specific handling |
| O8 | Partial | User lookup exists but may not map `contact_id` → email |
| O9 | Missing | No locale resolution |
| O10 | Missing | No status callbacks |
| O11 | N/A | No mobile |
| O12 | N/A | Or partial if email tracking maps to `delivery.delivered` |
| O13 | Missing | No expiration check |
| O14 | Missing | No outbound OAuth |

### Email-Specific Guidance

The plan should address:
- Resolving `contact_id` to an email address (may already be the email)
- Building an HTML email with localized `summary` and `details` from `messages[]`
- Including `survey_url` as a clickable link
- Using SendGrid open/click tracking to detect engagement
- Mapping email bounce → `delivery.failed` (non-retryable)
- Mapping email open or link click → `delivery.delivered`
- The reference app's push-specific code (FCM, mobile UI) should be cited
  as pattern examples only, not recommended for implementation

### Anti-Pattern Checks

- Must NOT recommend FCM, Expo, React Native, or mobile components
- Must NOT recommend SQS or DynamoDB (use Bull + PostgreSQL)
- Must mark O11 and O12 as N/A (or adapt O12 to email tracking)
- Must address email-specific delivery tracking

### Minimum Passing Score

- Contract: 24/30 (O11, O12 as N/A; 12 of 14 addressed)
- Stack Adaptation: 25/25 (Express + Bull + PostgreSQL + SendGrid)
- File Mapping: 15/20 (plausible file names, reference files correct)
- Gap Analysis: 12/15 (N/A items justified, email tracking noted)
- Testing: 8/10 (core test cases, email-specific cases)
- **Total: >= 75/100** (lower threshold for server-only)
