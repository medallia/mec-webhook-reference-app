# Integration Plan — Output Template

Use this template to structure the integration plan emitted in Phase 5.
Replace placeholder text with specifics from the integrator's stack and
gap analysis.

---

## Executive Summary

_One paragraph describing the integration scope, delivery channel, and
estimated effort._

> Example: "This plan maps the Medallia Distribution Webhook contract onto
> the existing Spring Boot backend and Kotlin Android app. The integration
> adds a new `/distribute` endpoint, a RabbitMQ consumer for async delivery,
> and FCM push via the existing notification service. Estimated effort:
> 3–4 sprints."

---

## Stack Profile

| Concern | Integrator's Choice | Reference Equivalent |
|---------|--------------------|--------------------|
| Language / Runtime | | TypeScript / Node.js 22 |
| Server Framework | | AWS Lambda + API Gateway |
| Message Queue | | Amazon SQS |
| Database | | Amazon DynamoDB |
| Push / Delivery Provider | | Firebase Cloud Messaging |
| Mobile Platform | | React Native (Expo) |
| Auth (Inbound) | | HTTP Basic Auth |
| Auth (Outbound) | | OAuth 2.0 client-credentials |
| Secrets Management | | AWS Secrets Manager |
| CI/CD | | GitHub Actions + Jenkins |

---

## Contract Coverage Matrix

| ID | Obligation | Status | Integrator Component | Notes |
|----|-----------|--------|---------------------|-------|
| O1 | Webhook endpoint | _Implemented / Partial / Missing_ | | |
| O2 | Inbound authentication | | | |
| O3 | Auth-check handling | | | |
| O4 | Invitation validation | | | |
| O5 | Idempotency | | | |
| O6 | Async accept (202) | | | |
| O7 | Async delivery worker | | | |
| O8 | Recipient lookup | | | |
| O9 | Locale resolution | | | |
| O10 | Status callbacks | | | |
| O11 | Device registration | | | |
| O12 | Delivery acknowledgement | | | |
| O13 | Expired invitation handling | | | |
| O14 | Callback authentication | | | |

---

## Gap Analysis

### Missing Obligations

_List obligations marked "Missing" above with implementation guidance._

| ID | Gap | Recommended Approach | Reference File |
|----|-----|---------------------|---------------|
| | | | |

### Anti-Patterns Found

_List any anti-patterns from the checklist found in the integrator's code._

| Anti-Pattern | Location | Remediation |
|-------------|----------|-------------|
| | | |

### Reference Best Practices to Adopt

_List applicable best practices (R1–R8) with stack-specific adaptation._

| ID | Practice | Recommendation |
|----|----------|---------------|
| | | |

---

## Phased Implementation Plan

### Phase 1: Webhook Endpoint + Auth (O1–O5)

_Describe the files to create/modify, the endpoint route, auth mechanism,
CloudEvents parsing, idempotency strategy, and database schema._

**Files to create:**
- _list specific files in the integrator's repo_

**Files to reference:**
- _list specific files in the reference repo_

### Phase 2: Async Processing + Delivery (O6–O9, O13)

_Describe the queue setup, worker implementation, recipient lookup,
locale resolution, delivery mechanism, and expired invitation handling._

### Phase 3: Status Callbacks (O10, O14)

_Describe outbound callback implementation, OAuth token management,
callback URL validation, and error handling._

### Phase 4: Mobile Integration (O11–O12) _(if applicable)_

_Describe device registration, push notification handling, survey display,
and delivery acknowledgement._

### Phase 5: Testing + Hardening

_Describe integration tests, contract compliance verification, and
production readiness checks._

---

## Testing Plan

| Test Case | Validates | Expected Result |
|-----------|----------|-----------------|
| Auth-check request | O2, O3 | 200 with `authcheck.success` CloudEvent |
| Valid invitation | O1, O4, O5, O6 | 202 with `delivery.queued` CloudEvent |
| Duplicate invitation (same `id`) | O5 | 202 with identical response body |
| Expired invitation | O13 | 200 with `delivery.failed` (`INVITATION_EXPIRED`) |
| Missing required fields | O4 | 400 Bad Request |
| Invalid credentials | O2 | 401 Unauthorized |
| Successful delivery | O7, O8, O9, O10 | Push/email sent; `delivery.sent` callback posted |
| Device not registered | O8, O10 | `delivery.failed` callback (`DEVICE_NOT_REGISTERED`) |
| Delivery acknowledgement | O12, O10 | `delivery.delivered` callback posted |
| Callback URL not in allowlist | R4 | Callback rejected, no OAuth token sent |

---

## Risks and Open Questions

| Risk / Question | Mitigation |
|----------------|------------|
| | |

---

## Privacy and Data Deletion _(Optional)_

_If the integrator stores PII or operates under GDPR/CCPA:_

| Concern | Recommendation | Reference |
|---------|---------------|-----------|
| Contact-ID storage | Hash with HMAC-SHA256 | `backend/src/utils/hash.ts` |
| Device deletion | Provide deletion endpoint | `backend/src/handlers/deviceDelete.ts` |
| Log redaction | Sanitise PII in structured logs | `backend/src/utils/logger.ts` |
| Data retention | TTL on message records | `backend/src/services/idempotency.ts` |
