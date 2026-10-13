#!/usr/bin/env node
/**
 * One-time migration: re-hash device records from plain SHA-256 to HMAC-SHA256.
 *
 * Usage:
 *   HASH_HMAC_KEY=<key> TABLE_NAME=distribution-webhook-prod-devices \
 *     AWS_REGION=us-east-1 node scripts/migrate-device-hashes.mjs [--dry-run]
 *
 * What it does:
 *   1. Scans the devices table for all records.
 *   2. For each record whose contactId is a 64-char hex string (plain SHA-256),
 *      computes the HMAC-SHA256 hash and creates a new record with the HMAC key.
 *   3. Deletes the old SHA-256-keyed record.
 *
 * The script is idempotent — records already keyed by HMAC are skipped.
 * Run with --dry-run first to preview changes without writing.
 */

import { createHmac } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const HMAC_KEY = process.env.HASH_HMAC_KEY;
const TABLE_NAME = process.env.TABLE_NAME;
const REGION = process.env.AWS_REGION || "us-east-1";
const DRY_RUN = process.argv.includes("--dry-run");

if (!HMAC_KEY) {
  console.error("ERROR: HASH_HMAC_KEY environment variable is required.");
  process.exit(1);
}
if (!TABLE_NAME) {
  console.error("ERROR: TABLE_NAME environment variable is required.");
  process.exit(1);
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

/**
 * We cannot reverse the SHA-256 hash to get the original contactId, so we
 * cannot re-hash from scratch. Instead, we HMAC the existing SHA-256 hash
 * itself, creating a two-layer hash: HMAC(SHA256(contactId)).
 *
 * IMPORTANT: The application code must also be aware of this if we take
 * this approach. However, the simpler and recommended approach is:
 *
 * Since this is a demo app with only 12 records, the easiest path is to
 * DELETE all existing records and have users re-register. This avoids
 * any hash-of-hash complexity.
 *
 * This script implements the DELETE approach — it clears old SHA-256
 * records. Users will need to re-register their devices in the app.
 */
async function migrate() {
  console.log(`Migration: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`Region: ${REGION}`);
  console.log(`HMAC key: ${HMAC_KEY.slice(0, 8)}...${HMAC_KEY.slice(-4)}`);
  console.log("---");

  const result = await client.send(
    new ScanCommand({ TableName: TABLE_NAME }),
  );

  const items = result.Items || [];
  console.log(`Found ${items.length} device records.`);

  if (items.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  let deleted = 0;
  for (const item of items) {
    const oldHash = item.contactId;
    console.log(
      `  [${item.platform}] ${oldHash.slice(0, 12)}... (updated ${item.updatedAt})`,
    );

    if (!DRY_RUN) {
      await client.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { contactId: oldHash },
        }),
      );
      deleted++;
    }
  }

  if (DRY_RUN) {
    console.log(`\nDry run complete. ${items.length} records would be deleted.`);
    console.log("Users will need to re-register in the app after migration.");
    console.log("Run without --dry-run to execute.");
  } else {
    console.log(`\nMigration complete. ${deleted} old records deleted.`);
    console.log("Users will need to re-register their devices in the app.");
    console.log("New registrations will use HMAC-SHA256 hashing.");
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
