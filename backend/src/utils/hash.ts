import { createHash, createHmac } from "node:crypto";

/**
 * Optional HMAC key for keyed hashing.  When set, hashContactId uses
 * HMAC-SHA256 so stored hashes cannot be reversed without the key.
 * Initialised from the HASH_HMAC_KEY environment variable at cold start
 * or explicitly via {@link setHashHmacKey}.
 *
 * When the key is empty/unset, falls back to plain SHA-256 for backward
 * compatibility with existing DynamoDB records.
 *
 * Migration note: switching from plain SHA-256 to HMAC produces different
 * hashes.  Existing DynamoDB entries must be re-hashed before enabling
 * HMAC in production.  See README "Security Considerations" for details.
 */
let hmacKey: string | undefined = process.env.HASH_HMAC_KEY || undefined;

/**
 * Initialise the HMAC key from a Secrets Manager value at cold start.
 * Called by config.ts after reading HASH_HMAC_SECRET_ARN.
 */
export function initHmacKeyFromSecret(key: string | undefined): void {
  if (key) {
    hmacKey = key;
  }
}

export function setHashHmacKey(key: string | undefined): void {
  hmacKey = key || undefined;
}

/**
 * Hash a contact ID for privacy-safe storage and consistent lookups.
 * Uses HMAC-SHA256 when a key is configured, plain SHA-256 otherwise.
 * Normalizes with trim + lowercase to avoid case/whitespace mismatches
 * between the mobile app and Medallia webhook payloads.
 */
export function hashContactId(contactId: string): string {
  const normalized = contactId.trim().toLowerCase();
  if (hmacKey) {
    return createHmac("sha256", hmacKey).update(normalized).digest("hex");
  }
  return createHash("sha256").update(normalized).digest("hex");
}
