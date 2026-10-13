import type { InvitationData, InvitationMessage } from "../models/cloudevents.js";

export interface ResolvedMessage {
  locale: string;
  summary: string;
  details: string;
}

const DEFAULT_SUMMARY = "We'd love your feedback";
const DEFAULT_DETAILS =
  "Thank you for your recent experience. Would you take a moment to share your feedback?";

function messageBody(message?: InvitationMessage): string | undefined {
  return message?.details ?? message?.content;
}

/**
 * Resolve localized invitation copy using preferred locale, then first message, then defaults.
 */
export function resolveInvitationMessage(data: InvitationData): ResolvedMessage {
  const messages = data.messages ?? [];
  const preferred = data.preferred_locale;

  let selected: InvitationMessage | undefined;

  if (preferred) {
    selected = messages.find((message) => message.locale === preferred);
    if (!selected) {
      const preferredBase = preferred.split("-")[0];
      selected = messages.find((message) => message.locale.startsWith(preferredBase));
    }
  }

  if (!selected && messages.length > 0) {
    selected = messages[0];
  }

  return {
    locale: selected?.locale ?? preferred ?? "en-US",
    summary: selected?.summary ?? DEFAULT_SUMMARY,
    details: messageBody(selected) ?? DEFAULT_DETAILS,
  };
}

export function isInvitationExpired(expirationTimestamp: string, now = new Date()): boolean {
  return new Date(expirationTimestamp).getTime() <= now.getTime();
}
