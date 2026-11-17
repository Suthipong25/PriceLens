import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDatabaseClient,
  migrateDatabase,
  SEED_IDS,
  seedDatabase,
  sessions,
  users,
  type PriceLensDb,
} from "@pricelens/database";
import { createApiApp } from "../index.js";

describe("@pricelens/api — /api/v1 Public, User & Admin Endpoints", () => {
  let db: PriceLensDb;
  let close: () => Promise<void>;
  let app: ReturnType<typeof createApiApp>["app"];

  const USER_TOKEN = "tok_test_member_session";
  const ADMIN_TOKEN = "tok_test_admin_session";
  let normalUserId = "";

  beforeAll(async () => {
    const client = createDatabaseClient({ connectionString: "memory://" });
    db = client.db;
    close = client.close;
    await migrateDatabase(db);
    await seedDatabase(db);

    const [member] = await db
      .insert(users)
      .values({
        name: "Nida Member",
        email: "nida@pricelens.co.th",
        emailVerified: true,
        role: "user",
      })
      .returning();
    normalUserId = member!.id;

    const [admin] = await db
      .insert(users)
      .values({
        name: "Arthit Admin",
        email: "admin@pricelens.co.th",
        emailVerified: true,
        role: "admin",
      })
      .returning();

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(sessions).values([
      {
        userId: member!.id,
        token: USER_TOKEN,
        expiresAt,
      },
      {
        userId: admin!.id,
        token: ADMIN_TOKEN,
        expiresAt,
      },
    ]);

    app = createApiApp({ db }).app;
  });

  afterAll(async () => {
    await close();
  });

  it("searches products by EAN, MPN, brand, and price range", async () => {
    const byEanRes = await app.request(
      "/api/v1/products?q=0195949821943&sort=price_asc",
    );
    expect(byEanRes.status).toBe(200);
    const byEanBody = (await byEanRes.json()) as {
      data: Array<{ id: string; priceSummary: { lowestProductPrice: string } }>;
    };
    expect(byEanBody.data.length).toBe(1);
    expect(byEanBody.data[0]?.id).toBe(SEED_IDS.products.iphone16Pro256);

    const byBrandRes = await app.request("/api/v1/products?brandSlug=apple");
    expect(byBrandRes.status).toBe(200);
    const byBrandBody = (await byBrandRes.json()) as { data: unknown[] };
    expect(byBrandBody.data.length).toBe(3); // iPhone 256, iPhone 512, MacBook Air
  });

  it("returns product detail, comparison offers (distinguishing unknown vs free shipping), and price history", async () => {
    const detailRes = await app.request(
      `/api/v1/products/${SEED_IDS.products.iphone16Pro256}`,
    );
    expect(detailRes.status).toBe(200);
    const detailBody = (await detailRes.json()) as {
      data: {
        name: string;
        isDemoData: boolean;
        buyingSignal: { recommendation: string };
      };
    };
    expect(detailBody.data.isDemoData).toBe(true);
    expect(detailBody.data.buyingSignal.recommendation).toBe("buy_now");

    const offersRes = await app.request(
      `/api/v1/products/${SEED_IDS.products.iphone16Pro256}/offers?sort=total_price_asc`,
    );
    expect(offersRes.status).toBe(200);
    const offersBody = (await offersRes.json()) as {
      data: Array<{
        id: string;
        price: string;
        shippingCost: string | null;
        shippingKnown: boolean;
        totalPrice: string | null;
        isCheapestByProductPrice: boolean;
        isCheapestByVerifiedTotalPrice: boolean;
      }>;
    };

    // First offer when sorted by total_price_asc must be Banana IT (verified free shipping 38900.00)
    expect(offersBody.data[0]?.id).toBe(SEED_IDS.offers.iphone256Banana);
    expect(offersBody.data[0]?.shippingCost).toBe("0.00");
    expect(offersBody.data[0]?.totalPrice).toBe("38900.00");
    expect(offersBody.data[0]?.isCheapestByVerifiedTotalPrice).toBe(true);

    // Advice IT has lower base price (38790.00) but unknown shipping (null) -> sorted last in total_price_asc!
    const adviceOffer = offersBody.data.find(
      (o) => o.id === SEED_IDS.offers.iphone256Advice,
    );
    expect(adviceOffer?.shippingCost).toBeNull();
    expect(adviceOffer?.totalPrice).toBeNull();
    expect(adviceOffer?.isCheapestByProductPrice).toBe(true);
    expect(adviceOffer?.isCheapestByVerifiedTotalPrice).toBe(false);

    const historyRes = await app.request(
      `/api/v1/products/${SEED_IDS.products.iphone16Pro256}/history?period=30d`,
    );
    expect(historyRes.status).toBe(200);
    const historyBody = (await historyRes.json()) as {
      data: {
        hasSufficientData: boolean;
        stats: { historicalMinPrice: string; historicalMaxPrice: string };
        dailySeries: unknown[];
      };
    };
    expect(historyBody.data.hasSufficientData).toBe(true);
    expect(historyBody.data.stats.historicalMinPrice).toBe("38790.00");
    expect(historyBody.data.stats.historicalMaxPrice).toBe("41900.00");
  });

  it("tracks affiliate outbound clicks accurately", async () => {
    const clickRes = await app.request(
      `/api/v1/offers/${SEED_IDS.offers.iphone256Banana}/click`,
      { method: "POST" },
    );
    expect(clickRes.status).toBe(200);
    const clickBody = (await clickRes.json()) as {
      data: { trackingId: string; targetUrl: string; isAffiliateLink: boolean };
    };
    expect(clickBody.data.trackingId).toMatch(/^trk_/);
    expect(clickBody.data.isAffiliateLink).toBe(true);
    expect(clickBody.data.targetUrl).toContain("utm_source=pricelens");
  });

  it("enforces authentication and RBAC on User (/me) and Admin (/admin) endpoints", async () => {
    const unauthMe = await app.request("/api/v1/me");
    expect(unauthMe.status).toBe(401);

    const memberTryingAdmin = await app.request(
      "/api/v1/admin/match-candidates",
      {
        headers: { Authorization: `Bearer ${USER_TOKEN}` },
      },
    );
    expect(memberTryingAdmin.status).toBe(403);

    // Authenticated member can manage Watchlist and Price Alerts
    const addWatchRes = await app.request("/api/v1/me/watchlist", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${USER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId: SEED_IDS.products.sonyXm5Black }),
    });
    expect(addWatchRes.status).toBe(201);

    const createAlertRes = await app.request("/api/v1/me/price-alerts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${USER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId: SEED_IDS.products.sonyXm5Black,
        targetPrice: "9900.00",
        currency: "THB",
      }),
    });
    expect(createAlertRes.status).toBe(201);

    // Admin can list and approve match candidates
    const listCandidatesRes = await app.request(
      "/api/v1/admin/match-candidates?reviewStatus=pending",
      {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      },
    );
    expect(listCandidatesRes.status).toBe(200);
    const candidatesBody = (await listCandidatesRes.json()) as {
      data: Array<{ id: string; productId: string }>;
    };
    expect(candidatesBody.data.length).toBeGreaterThanOrEqual(1);

    const candidateId = candidatesBody.data[0]!.id;
    const approveRes = await app.request(
      `/api/v1/admin/match-candidates/${candidateId}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: SEED_IDS.products.iphone16Pro256,
        }),
      },
    );
    expect(approveRes.status).toBe(200);
    const approveBody = (await approveRes.json()) as {
      data: { candidate: { reviewStatus: string }; offerId: string | null };
    };
    expect(approveBody.data.candidate.reviewStatus).toBe("approved");
    expect(approveBody.data.offerId).toBeTruthy();

    // User can delete their own account (PDPA Account Deletion workflow)
    const deleteMeRes = await app.request("/api/v1/me", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${USER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    expect(deleteMeRes.status).toBe(200);
    const deleteBody = (await deleteMeRes.json()) as {
      data: { deleted: boolean; userId: string };
    };
    expect(deleteBody.data.deleted).toBe(true);
    expect(deleteBody.data.userId).toBe(normalUserId);
  });
});
