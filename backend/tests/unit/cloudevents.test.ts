import { describe, expect, it } from "vitest";
import { parseBasicAuthHeader } from "../../src/utils/auth.js";
import {
  buildAuthCheckResponse,
  buildDistributionUpdate,
  validateCloudEventEnvelope,
} from "../../src/utils/cloudevents.js";
import { EventTypes } from "../../src/models/cloudevents.js";

describe("parseBasicAuthHeader", () => {
  it("parses valid basic auth credentials", () => {
    const encoded = Buffer.from("webhook-user:webhook-pass").toString("base64");
    expect(parseBasicAuthHeader(`Basic ${encoded}`)).toEqual({
      username: "webhook-user",
      password: "webhook-pass",
    });
  });

  it("returns null for invalid header", () => {
    expect(parseBasicAuthHeader("Bearer token")).toBeNull();
  });
});

describe("CloudEvent helpers", () => {
  it("builds queued distribution update", () => {
    const update = buildDistributionUpdate({
      messageId: "abc-123",
      traceparent: "trace-1",
      type: EventTypes.DELIVERY_QUEUED,
    });

    expect(update.data.message_id).toBe("abc-123");
    expect(update.type).toBe(EventTypes.DELIVERY_QUEUED);
    expect(update.source).toBe("urn:client:webhook");
  });

  it("builds auth check success response", () => {
    const response = buildAuthCheckResponse({
      messageId: "auth-1",
      success: true,
    });

    expect(response.type).toBe(EventTypes.AUTH_CHECK_SUCCESS);
  });

  it("validates required envelope fields", () => {
    expect(() =>
      validateCloudEventEnvelope({
        specversion: "1.0",
        id: "",
        source: "urn:client:webhook",
        type: "test",
      }),
    ).toThrow();
  });
});
