# Evaluation Results — [Date]

**Model:** [model name and version]
**Evaluator:** [human or automated]

---

## Scenario: [scenario name]

### Scores

| Category | Max | Score | Notes |
|----------|-----|-------|-------|
| Contract Coverage | 30 | | |
| Stack Adaptation | 25 | | |
| File Mapping Accuracy | 20 | | |
| Gap Analysis Quality | 15 | | |
| Testing Plan | 10 | | |
| **Total** | **100** | | |

### Contract Obligation Coverage

| ID | Obligation | Addressed? | Notes |
|----|-----------|------------|-------|
| O1 | Webhook endpoint | | |
| O2 | Inbound authentication | | |
| O3 | Auth-check handling | | |
| O4 | Invitation validation | | |
| O5 | Idempotency | | |
| O6 | Async accept (202) | | |
| O7 | Async delivery worker | | |
| O8 | Recipient lookup | | |
| O9 | Locale resolution | | |
| O10 | Status callbacks | | |
| O11 | Device registration | | |
| O12 | Delivery acknowledgement | | |
| O13 | Expired invitation handling | | |
| O14 | Callback authentication | | |

### Anti-Patterns Check

- [ ] No sync push in webhook handler recommended
- [ ] No AWS/Lambda/Expo copying for non-AWS stack
- [ ] Idempotency mechanism present
- [ ] Callback URL validation addressed
- [ ] `delivery.delivered` callback included

### Observations

_Free-form notes on the plan quality, missed items, or standout features._

---

## Summary

| Scenario | Score | Pass? |
|----------|-------|-------|
| | | |

**Average:** /100
**Ship decision:** [PASS / FAIL / ITERATE]
