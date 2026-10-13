---
name: integrate-distribution-webhook
description: >
  This skill should be used when the user asks to integrate with Medallia's
  Distribution Webhook, plan a webhook integration, map their stack to the
  reference implementation, generate an integration plan, or review an
  existing Medallia webhook integration for completeness. Invoke when the
  user mentions "distribution webhook", "survey invitation webhook",
  "Medallia webhook integration", or asks to build a webhook receiver for
  Medallia survey invitations.
---

# Medallia Distribution Webhook — Integration Skill

Help integrators build a **stack-adapted** webhook receiver for Medallia
Experience Cloud survey invitations. This reference repository demonstrates
one working implementation (AWS Lambda + React Native); your job is to map
the **contract obligations** onto the integrator's own technology stack.

## Key Principle

Separate **Medallia contract** (CloudEvents format, status lifecycle, auth,
callbacks) from **reference implementation** (Lambda, SQS, DynamoDB, FCM,
Expo). Never recommend copying AWS/Lambda/Expo unless the integrator is
already on that stack.

---

## Workflow — 5 Phases

Use this checklist to track progress. Complete each phase before moving to
the next.

### Phase 1: Orient

- [ ] Read [contract-summary.md](../../../docs/integration/contract-summary.md)
- [ ] Read [reference-map.md](reference-map.md) to understand how this repo fulfils each obligation
- [ ] Skim [docs/architecture.md](../../../docs/architecture.md) for the end-to-end flow
- [ ] Note: this repo is a **reference**, not a template to copy

### Phase 2: Discover Integrator Stack

- [ ] Read the integrator's repository: framework, language, existing APIs, database, queue, push/email provider
- [ ] Identify existing webhook handlers, message queues, notification services
- [ ] Ask: **"How do you want to distribute invitations?"** (select all that apply: mobile push, email, SMS, or other)
- [ ] Follow-up: **"Will each invitation go to one channel, or multiple channels in parallel?"** (one channel per invite / parallel multi-channel / other)
- [ ] If stack details are still ambiguous, ask at most **1 additional clarifying question**
- [ ] Record a **stack profile**: language, framework, queue, DB, delivery channel, auth mechanism, mobile platform (if applicable)

### Phase 3: Map Responsibilities

- [ ] Open [contract-checklist.md](contract-checklist.md) — walk through O1–O14
- [ ] For each obligation, identify the integrator's equivalent component (or note as "needs implementation")
- [ ] Consult [decision-guide.md](decision-guide.md) for stack-specific adaptation patterns
- [ ] For mobile integrations: map device registration, push receipt, survey display, delivery-ack flows

### Phase 4: Gap Analysis

- [ ] For each obligation, classify: **Implemented** / **Partial** / **Missing** / **N/A**
- [ ] Flag **anti-patterns** from the checklist (sync push, no idempotency, missing `delivery.delivered`, etc.)
- [ ] Note reference-only best practices the integrator should consider (hashing, log redaction, callback URL validation)
- [ ] For server-only integrations: mark mobile obligations (O11, O12) as N/A

### Phase 5: Emit Plan

- [ ] Use [output-template.md](output-template.md) to structure the integration plan
- [ ] Fill in: Executive Summary, Stack Profile, Contract Coverage Matrix, Gap Analysis, Phased Implementation Plan, Testing Plan, Risks
- [ ] Name specific files in both the reference repo and the integrator's repo
- [ ] Include code snippets from reference files where they illustrate the contract pattern (not the AWS-specific implementation)

---

## Post-Implementation Review (Optional)

After the integrator has implemented changes, re-run the checklist:

- [ ] Re-walk O1–O14 against the integrator's updated code
- [ ] Verify all status transitions are reported to Medallia
- [ ] Check idempotency mechanism is in place
- [ ] Confirm callback URL validation prevents SSRF
- [ ] Verify auth-check returns correct CloudEvent response
- [ ] Check expired invitation handling (sync rejection)
- [ ] Note any remaining gaps or anti-patterns

---

## Quick Reference

| Resource | Path |
|----------|------|
| Contract summary | [docs/integration/contract-summary.md](../../../docs/integration/contract-summary.md) |
| Contract checklist | [contract-checklist.md](contract-checklist.md) |
| Reference map | [reference-map.md](reference-map.md) |
| Decision guide | [decision-guide.md](decision-guide.md) |
| Output template | [output-template.md](output-template.md) |
| OpenAPI (inbound) | [docs/api/distribute-v1\_0\_0.yaml](../../../docs/api/distribute-v1_0_0.yaml) |
| OpenAPI (outbound) | [docs/api/status-v1\_0\_0.yaml](../../../docs/api/status-v1_0_0.yaml) |
| Architecture | [docs/architecture.md](../../../docs/architecture.md) |
| Test fixtures | [backend/tests/fixtures/](../../../backend/tests/fixtures/) |
| Sample auth-check | [docs/api/sample-auth-check.json](../../../docs/api/sample-auth-check.json) |

---

## Rules for the Agent

1. **Do** name specific files in both reference and integrator repos.
2. **Do** separate Medallia contract from reference implementation choices.
3. **Do not** recommend copying Terraform, Lambda, SQS, DynamoDB, or Expo
   code unless the integrator uses that exact stack.
4. **Do not** invent features not present in the reference code.
5. **Do** cite test fixtures and OpenAPI specs as canonical contract examples.
6. **Do** flag anti-patterns from the checklist.
7. **Do** include a testing plan that covers auth-check, happy-path delivery,
   expired invitations, idempotency, and callback validation.
