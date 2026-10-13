import { describe, expect, it } from "vitest";
import { resolveInvitationMessage, isInvitationExpired } from "../../src/utils/locale.js";
import type { InvitationData } from "../../src/models/cloudevents.js";

describe("resolveInvitationMessage", () => {
  const baseData: InvitationData = {
    record_type: "preview",
    survey_id: "survey-123",
    survey_url: "https://survey.example.com",
    contact_id: "demo@example.com",
    expiration_timestamp: "2026-12-31T23:59:59.000Z",
    callback: "https://example.com/status",
    preferred_locale: "en-US",
    messages: [
      { locale: "en-US", summary: "English summary", details: "English details" },
      { locale: "es-US", summary: "Spanish summary", details: "Spanish details" },
    ],
  };

  it("prefers exact locale match", () => {
    const resolved = resolveInvitationMessage(baseData);
    expect(resolved.summary).toBe("English summary");
    expect(resolved.locale).toBe("en-US");
  });

  it("falls back to language prefix", () => {
    const resolved = resolveInvitationMessage({
      ...baseData,
      preferred_locale: "en-GB",
    });
    expect(resolved.summary).toBe("English summary");
  });

  it("falls back to first message when no preferred locale matches", () => {
    const resolved = resolveInvitationMessage({
      ...baseData,
      preferred_locale: "fr-FR",
    });
    expect(resolved.summary).toBe("English summary");
  });

  it("uses defaults when messages are missing", () => {
    const resolved = resolveInvitationMessage({
      ...baseData,
      messages: [],
      preferred_locale: undefined,
    });
    expect(resolved.summary).toContain("feedback");
    expect(resolved.details.length).toBeGreaterThan(0);
  });

  it("uses content when details is absent", () => {
    const resolved = resolveInvitationMessage({
      ...baseData,
      preferred_locale: null as unknown as undefined,
      messages: [
        {
          locale: "en",
          summary: "This is a demo title",
          content: "This is a demo notification. Take the survey!",
        },
      ],
    });
    expect(resolved.summary).toBe("This is a demo title");
    expect(resolved.details).toBe("This is a demo notification. Take the survey!");
  });

  it("prefers details over content when both are present", () => {
    const resolved = resolveInvitationMessage({
      ...baseData,
      messages: [
        {
          locale: "en-US",
          summary: "Title",
          details: "Details text",
          content: "Content text",
        },
      ],
    });
    expect(resolved.details).toBe("Details text");
  });
});

describe("isInvitationExpired", () => {
  it("returns true for past timestamps", () => {
    expect(isInvitationExpired("2020-01-01T00:00:00.000Z", new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
  });

  it("returns false for future timestamps", () => {
    expect(isInvitationExpired("2030-01-01T00:00:00.000Z", new Date("2026-01-01T00:00:00.000Z"))).toBe(false);
  });
});
