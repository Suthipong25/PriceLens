import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  createDatabaseClient,
  migrateDatabase,
  offers,
  priceSnapshots,
  productIdentifiers,
  products,
  SEED_IDS,
  seedDatabase,
  type PriceLensDb,
} from "../index.js";

describe("@pricelens/database (PostgreSQL 16 Schema & Constraints)", () => {
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

  it("seeds canonical products, offers, and snapshots idempotently", async () => {
    // Run seed a second time to verify idempotency
    await seedDatabase(db);

    const allProducts = await db.select().from(products);
    expect(allProducts.length).toBe(6);
    expect(allProducts.every((p) => p.attributes.is_demo === true)).toBe(true);

    const iphoneOffers = await db
      .select()
      .from(offers)
      .where(eq(offers.productId, SEED_IDS.products.iphone16Pro256));
    expect(iphoneOffers.length).toBe(3);

    // Check unknown shipping vs free shipping
    const adviceOffer = iphoneOffers.find(
      (o) => o.id === SEED_IDS.offers.iphone256Advice,
    );
    expect(adviceOffer?.shippingCost).toBeNull();
    expect(adviceOffer?.totalPrice).toBeNull();

    const bananaOffer = iphoneOffers.find(
      (o) => o.id === SEED_IDS.offers.iphone256Banana,
    );
    expect(bananaOffer?.shippingCost).toBe("0.00");
    expect(bananaOffer?.totalPrice).toBe("38900.00");
  });

  it("enforces CHECK constraint: rejects total_price when shipping_cost is NULL", async () => {
    await expect(
      db.insert(offers).values({
        productId: SEED_IDS.products.iphone16Pro256,
        merchantId: SEED_IDS.merchants.bananaIt,
        sourceId: SEED_IDS.sources.csvDemo,
        externalProductId: "INVALID-TOTAL-WHEN-NULL-SHIPPING",
        title: "Invalid Offer With Fabricated Total Price",
        productUrl: "https://www.bnn.in.th/th/p/invalid",
        price: "38900.00",
        currency: "THB",
        shippingCost: null,
        totalPrice: "38900.00", // Must fail CHECK constraint!
      }),
    ).rejects.toThrow();
  });

  it("enforces CHECK constraint: rejects total_price != price + shipping_cost", async () => {
    await expect(
      db.insert(offers).values({
        productId: SEED_IDS.products.iphone16Pro256,
        merchantId: SEED_IDS.merchants.bananaIt,
        sourceId: SEED_IDS.sources.csvDemo,
        externalProductId: "INVALID-MATH-TOTAL",
        title: "Invalid Offer Math",
        productUrl: "https://www.bnn.in.th/th/p/invalid-math",
        price: "38900.00",
        currency: "THB",
        shippingCost: "50.00",
        totalPrice: "38900.00", // Should be 38950.00 -> must fail CHECK constraint!
      }),
    ).rejects.toThrow();
  });

  it("enforces UNIQUE NULLS NOT DISTINCT on global product identifiers", async () => {
    await expect(
      db.insert(productIdentifiers).values({
        productId: SEED_IDS.products.iphone16Pro512,
        type: "EAN",
        value: "0195949821943", // Already belongs to iphone16Pro256 with sourceId = null
        sourceId: null,
      }),
    ).rejects.toThrow();
  });

  it("preserves historical price_snapshots when updating an offer", async () => {
    const beforeSnapshots = await db
      .select()
      .from(priceSnapshots)
      .where(eq(priceSnapshots.offerId, SEED_IDS.offers.iphone256Banana));

    expect(beforeSnapshots.length).toBeGreaterThanOrEqual(5);

    await db
      .update(offers)
      .set({ price: "38500.00", totalPrice: "38500.00" })
      .where(eq(offers.id, SEED_IDS.offers.iphone256Banana));

    const afterSnapshots = await db
      .select()
      .from(priceSnapshots)
      .where(eq(priceSnapshots.offerId, SEED_IDS.offers.iphone256Banana));

    expect(afterSnapshots.length).toBe(beforeSnapshots.length);
  });
});
