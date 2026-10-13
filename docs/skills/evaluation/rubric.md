# Evaluation Rubric — 100 Points

## 1. Contract Coverage (30 points)

| Points | Criterion |
|--------|-----------|
| 2 | O1 — Webhook endpoint identified and mapped |
| 2 | O2 — Inbound authentication addressed |
| 2 | O3 — Auth-check handling included |
| 2 | O4 — Invitation validation covered |
| 3 | O5 — Idempotency mechanism specified |
| 3 | O6 — Async accept (202) pattern described |
| 3 | O7 — Async worker / queue architecture planned |
| 2 | O8 — Recipient lookup mechanism identified |
| 2 | O9 — Locale resolution addressed |
| 3 | O10 — All three status callbacks planned (sent/failed/delivered) |
| 2 | O13 — Expired invitation handling included |
| 2 | O14 — Outbound callback authentication planned |
| 2 | O11+O12 — Device registration and delivery ack (or marked N/A with justification) |

## 2. Stack Adaptation (25 points)

| Points | Criterion |
|--------|-----------|
| 5 | Recommendations use the integrator's actual stack (framework, language, queue, DB) |
| 5 | No recommendation to copy AWS/Lambda/SQS/DynamoDB/Expo code to a different stack |
| 5 | Queue/async pattern adapted to integrator's infrastructure |
| 5 | Database/storage pattern adapted to integrator's infrastructure |
| 5 | Delivery channel adapted (push, email, SMS, etc.) to integrator's setup |

## 3. File Mapping Accuracy (20 points)

| Points | Criterion |
|--------|-----------|
| 5 | Reference files cited exist on the current branch (zero stale paths) |
| 5 | Integrator files named are plausible for the stated stack |
| 5 | Reference map obligations correctly matched to reference code |
| 5 | Key symbols/functions from reference code cited accurately |

## 4. Gap Analysis Quality (15 points)

| Points | Criterion |
|--------|-----------|
| 5 | Implemented/Partial/Missing/N/A classifications are accurate |
| 5 | Anti-patterns flagged where present in the scenario |
| 5 | Reference best practices (R1–R8) evaluated for applicability |

## 5. Testing Plan (10 points)

| Points | Criterion |
|--------|-----------|
| 2 | Auth-check test case included |
| 2 | Happy-path delivery test case included |
| 2 | Idempotency test case included |
| 2 | Expired invitation test case included |
| 2 | Callback validation or error case included |

---

## Scoring Scale

| Score | Rating |
|-------|--------|
| 90–100 | Excellent — ready for production use |
| 80–89 | Good — minor gaps, meets ship criteria |
| 70–79 | Acceptable — needs iteration on specific areas |
| 60–69 | Below threshold — significant gaps |
| < 60 | Fail — major rework needed |
