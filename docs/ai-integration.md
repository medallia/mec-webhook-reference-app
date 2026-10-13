# AI-Assisted Integration Guide

This guide explains how to use AI coding agents (Cursor, Claude, Copilot,
Gemini, etc.) to plan and build your own Medallia Distribution Webhook
integration using this reference repository as a guide.

## Multi-Root Workspace Setup

Add this reference repository alongside your own codebase so the AI agent
can read both:

### Cursor

1. Open your project in Cursor.
2. **File → Add Folder to Workspace** → select this cloned reference repo.
3. The agent can now read both your code and the reference implementation.
4. Use the integration skill: the agent will read
   `.cursor/skills/integrate-distribution-webhook/SKILL.md` automatically.

### VS Code + Copilot / Continue

1. **File → Add Folder to Workspace** → select this cloned reference repo.
2. Reference `AGENTS.md` or `.github/copilot-instructions.md` in your prompt.

### Claude (standalone)

1. Upload or reference the contract summary and relevant reference files.
2. See `CLAUDE.md` at the repository root.

---

## Example Prompts

### Generate an integration plan

> "I have a Spring Boot backend and a Kotlin Android app. Using the
> Medallia Distribution Webhook reference in the other workspace folder,
> create an integration plan for my stack. Follow the skill at
> `.cursor/skills/integrate-distribution-webhook/SKILL.md`."

### Review an existing integration

> "Review my webhook handler at `src/main/java/com/example/WebhookController.java`
> against the Medallia Distribution Webhook contract. Check all 14
> obligations from the contract checklist."

### Plan a server-only integration

> "I only have a Node.js backend — no mobile app. I want to deliver
> survey invitations via email using SendGrid. Plan the integration
> using the Medallia Distribution Webhook reference."

### Gap analysis on existing code

> "Compare my existing webhook implementation to the Medallia contract.
> List what's implemented, what's missing, and flag any anti-patterns."

---

## What Agents Should Do

- Read the contract summary and reference map to understand obligations.
- Discover your stack before making recommendations.
- Map each obligation to your specific files and components.
- Cite specific reference files as pattern examples (not as code to copy).
- Adapt infrastructure choices to your stack (don't prescribe AWS/Lambda).
- Include a testing plan covering auth-check, happy path, expired
  invitations, idempotency, and callback validation.

## What Agents Should NOT Do

- Copy AWS Lambda, SQS, DynamoDB, or Expo code into a non-AWS/non-Expo project.
- Skip the idempotency mechanism.
- Recommend synchronous delivery in the webhook handler.
- Ignore callback URL validation.
- Hardcode callback URLs instead of reading from `data.callback`.
- Assume mobile push is the only delivery channel.

---

## End-to-End Validation

After implementing, validate your integration:

1. **Auth-check**: Send an auth-check CloudEvent → expect 200 with
   `authcheck.success`.
2. **Happy path**: Send a valid invitation → expect 202 with
   `delivery.queued` → async delivery → `delivery.sent` callback →
   recipient opens survey → `delivery.delivered` callback.
3. **Idempotency**: Send the same CloudEvent `id` twice → expect
   identical 202 response.
4. **Expired invitation**: Send an invitation with past
   `expiration_timestamp` → expect 200 with `delivery.failed`
   (`INVITATION_EXPIRED`).
5. **Bad auth**: Send with wrong credentials → expect 401.
6. **Missing fields**: Omit `contact_id` → expect 400.

See [docs/setup.md](setup.md) for the reference app's setup and testing
instructions. Use `scripts/send-test-webhook.sh` to send test CloudEvents.
