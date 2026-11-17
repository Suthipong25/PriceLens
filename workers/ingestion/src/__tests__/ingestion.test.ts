import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  createDatabaseClient,
  migrateDatabase,
  notifications,
  offers,
  priceAlerts,
  productMatchCandidates,
  SEED_IDS,
  seedDatabase,
  users,
  type PriceLensDb,
} from "@pricelens/database";
import { executeIngestionJob } from "../index.js";

describe("@pricelens/ingestion — 10-Step Pipeline, Freshness & Alerts", () => {
  let db: PriceLensDb;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const client = createDatabaseClient({ connectionString: "memory://" });
    db = client.db;
    close = client.close;
    await migrateDatabase(db);
    await seedDatabase(db);
  });

  afterAll(async () => {
    await close();
  });

  it("imports CSV offers idempotently, rejects invalid rows, and routes uncertain matches to review queue", async () => {
    const csvPayload = [
      "externalProductId,merchantName,merchantWebsite,title,brandName,ean,mpn,price,shippingCost,currency,availabilityStatus,condition,productUrl,sourceUpdatedAt",
      // Row 1: Exact EAN match for iPhone 16 Pro 256GB with verified free shipping
      "CSV-BNN-IP16P-256,Banana IT (Demo),https://www.bnn.in.th,Apple iPhone 16 Pro 256GB Natural Titanium,Apple,0195949821943,MYN13TH/A,38400.00,0,THB,in_stock,new,https://www.bnn.in.th/th/p/ip16p-256,2026-11-16T10:00:00Z",
      // Row 2: Title-only match without EAN/MPN -> must be queued in product_match_candidates
      "CSV-NO-ID-SONY-XM5,Advice IT (Demo),https://www.advice.co.th,Sony WH-1000XM5 Wireless Noise Cancelling Headphones Black,Sony,,,10500.00,,THB,in_stock,new,https://www.advice.co.th/p/xm5,2026-11-16T10:00:00Z",
      // Row 3: Invalid currency (USD) -> must fail row validation without aborting batch
      "CSV-BAD-CURRENCY,Test Shop,https://example.com,Sony WH-1000XM5,Sony,4548736132603,,299.99,0,USD,in_stock,new,https://example.com/p/1,2026-11-16T10:00:00Z",
    ].join("\n");

    const firstRun = await executeIngestionJob(db, {
      sourceId: SEED_IDS.sources.csvDemo,
      jobType: "csv_import",
      payload: csvPayload,
    });

    expect(firstRun.status).toBe("partial");
    expect(firstRun.recordsProcessed).toBe(2);
    expect(firstRun.recordsFailed).toBe(1);
    expect(firstRun.autoMatchedCount).toBe(1);
    expect(firstRun.queuedForReviewCount).toBe(1);
    expect(firstRun.snapshotsRecorded).toBe(1);

    // Re-running the exact same CSV within 24h must NOT create duplicate offers or snapshots
    const secondRun = await executeIngestionJob(db, {
      sourceId: SEED_IDS.sources.csvDemo,
      jobType: "csv_import",
      payload: csvPayload,
    });
    expect(secondRun.autoMatchedCount).toBe(1);
    expect(secondRun.snapshotsRecorded).toBe(0);

    const candidates = await db
      .select()
      .from(productMatchCandidates)
      .where(eq(productMatchCandidates.externalProductId, "CSV-NO-ID-SONY-XM5"));
    expect(candidates.length).toBe(1);
    expect(candidates[0]?.reviewStatus).toBe("pending");
  });

  it("prevents older source_updated_at records from overwriting newer offer prices", async () => {
    const staleCsv = [
      "externalProductId,merchantName,merchantWebsite,title,brandName,ean,mpn,price,shippingCost,currency,availabilityStatus,condition,productUrl,sourceUpdatedAt",
      "CSV-BNN-IP16P-256,Banana IT (Demo),https://www.bnn.in.th,Apple iPhone 16 Pro 256GB Natural Titanium,Apple,0195949821943,MYN13TH/A,45900.00,0,THB,in_stock,new,https://www.bnn.in.th/th/p/ip16p-256,2026-10-01T00:00:00Z",
    ].join("\n");

    await executeIngestionJob(db, {
      sourceId: SEED_IDS.sources.csvDemo,
      jobType: "csv_import",
      payload: staleCsv,
    });

    const [storedOffer] = await db
      .select()
      .from(offers)
      .where(eq(offers.externalProductId, "CSV-BNN-IP16P-256"));

    // Price must remain 38400.00, NOT overwritten by stale 45900.00
    expect(storedOffer?.price).toBe("38400.00");
  });

  it("triggers price alert when price drops below target and suppresses duplicate notification on repeat run", async () => {
    const [testUser] = await db
      .insert(users)
      .values({
        name: "Somchai Shopper",
        email: "somchai@example.co.th",
        role: "user",
      })
      .returning();

    await db.insert(priceAlerts).values({
      userId: testUser!.id,
      productId: SEED_IDS.products.iphone16Pro256,
      targetPrice: "38500.00",
      currency: "THB",
      isActive: true,
    });

    const dropCsv = [
      "externalProductId,merchantName,merchantWebsite,title,brandName,ean,mpn,price,shippingCost,currency,availabilityStatus,condition,productUrl,sourceUpdatedAt",
      "CSV-BNN-IP16P-256,Banana IT (Demo),https://www.bnn.in.th,Apple iPhone 16 Pro 256GB Natural Titanium,Apple,0195949821943,MYN13TH/A,37900.00,0,THB,in_stock,new,https://www.bnn.in.th/th/p/ip16p-256,2026-11-16T12:00:00Z",
    ].join("\n");

    const run1 = await executeIngestionJob(db, {
      sourceId: SEED_IDS.sources.csvDemo,
      jobType: "csv_import",
      payload: dropCsv,
    });
    expect(run1.alertsTriggered).toBe(1);

    // Repeat run within cooldown -> must suppress duplicate email!
    const run2 = await executeIngestionJob(db, {
      sourceId: SEED_IDS.sources.csvDemo,
      jobType: "csv_import",
      payload: dropCsv,
    });
    expect(run2.alertsTriggered).toBe(0);

    const userNotifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, testUser!.id));
    expect(userNotifs.some((n) => n.status === "sent")).toBe(true);
    expect(userNotifs.some((n) => n.status === "suppressed_duplicate")).toBe(true);
  });
});
