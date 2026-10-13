# AI Agent Guide — Medallia Distribution Webhook Reference

This repository is a **reference implementation** for the Medallia
Experience Cloud Distribution Webhook. It demonstrates one complete
integration (AWS Lambda + React Native) so that integrators can build
their own on any stack.

## Contract vs Implementation

| Layer | What it is | Where to look |
|-------|-----------|---------------|
| **Medallia contract** | CloudEvents format, status lifecycle, auth, callbacks — required for every integration. | [docs/integration/contract-summary.md](docs/integration/contract-summary.md), [OpenAPI specs](docs/api/) |
| **Reference implementation** | AWS Lambda, SQS, DynamoDB, FCM, Expo — one way to fulfil the contract. | [backend/src/](backend/src/), [mobile/src/](mobile/src/), [infra/terraform/](infra/terraform/) |

**Never recommend copying the reference infrastructure** unless the
integrator is already on the same stack. Adapt the contract patterns.

## Integration Skill

For planning an integration against an integrator's codebase, use the
Cursor skill:

```
.cursor/skills/integrate-distribution-webhook/SKILL.md
```

The skill provides a 5-phase workflow (Orient → Discover → Map → Gap
Analysis → Emit Plan) with checklists, a reference map, decision guide,
and output template.

## Code Entry Points

| Component | Entry File | Purpose |
|-----------|-----------|---------|
| Webhook receiver | `backend/src/handlers/distribute.ts` | `POST /distribute` — auth-check, invitation validation, idempotency, async enqueue |
| Push worker | `backend/src/handlers/pushWorker.ts` | SQS consumer — device lookup, FCM push, status callbacks |
| Device registration | `backend/src/handlers/deviceRegister.ts` | `POST /devices/register` |
| Device deletion | `backend/src/handlers/deviceDelete.ts` | `DELETE /devices/{contactId}` |
| Delivery ack | `backend/src/handlers/deliveryAck.ts` | `POST /devices/delivery-ack` |
| Status callbacks | `backend/src/services/statusCallback.ts` | Outbound CloudEvent updates to Medallia |
| Idempotency | `backend/src/services/idempotency.ts` | DynamoDB conditional put on messageId |
| Device registry | `backend/src/services/deviceRegistry.ts` | CRUD for device registrations |
| Push service | `backend/src/services/pushService.ts` | Firebase Cloud Messaging sender |
| CloudEvents models | `backend/src/models/cloudevents.ts` | All event types, interfaces, guards |
| Locale resolution | `backend/src/utils/locale.ts` | `resolveInvitationMessage()` |
| Auth utilities | `backend/src/utils/auth.ts` | Basic Auth + API key validation |
| Config loader | `backend/src/config.ts` | Secrets Manager + env var loading |
| Mobile app entry | `mobile/App.tsx` | Push handling, survey navigation, delivery ack |
| Mobile API client | `mobile/src/services/api.ts` | Backend API calls |
| Mobile push modules | `mobile/src/services/push*.ts` | FCM handling, payload extraction, presentation |

## Documentation

| Document | Path |
|----------|------|
| Architecture overview | [docs/architecture.md](docs/architecture.md) |
| Contract summary | [docs/integration/contract-summary.md](docs/integration/contract-summary.md) |
| AI integration guide | [docs/ai-integration.md](docs/ai-integration.md) |
| Setup guide | [docs/setup.md](docs/setup.md) |
| OpenAPI — inbound | [docs/api/distribute-v1\_0\_0.yaml](docs/api/distribute-v1_0_0.yaml) |
| OpenAPI — outbound | [docs/api/status-v1\_0\_0.yaml](docs/api/status-v1_0_0.yaml) |
| Test fixtures | [backend/tests/fixtures/](backend/tests/fixtures/) |

## Test Fixtures

| File | Content |
|------|---------|
| `distribution-request.json` | Sample invitation CloudEvent |
| `auth-check-request.json` | Sample auth-check CloudEvent |
| `distribution-update-queued.json` | Sample `delivery.queued` response |
| `distribution-update-failed-retryable.json` | Sample `delivery.failed` with retryable error |
