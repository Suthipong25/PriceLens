import { describe, expect, it } from "vitest";
import {
  analyzePriceHistory,
  annotateAndSortOffers,
  calculateOfferTotalPrice,
  evaluatePriceAlertCondition,
  matchProductDeterministically,
  type CanonicalProductCandidate,
} from "../index.js";

const SAMPLE_CATALOG: CanonicalProductCandidate[] = [
  {
    id: "prod-iphone16pro-256-nat",
    name: "Apple iPhone 16 Pro 256GB Natural Titanium",
    brandName: "Apple",
    model: "MYN13TH/A",
    attributes: {
      storage_capacity: "256GB",
      ram: "8GB",
      color: "Natural Titanium",
      condition: "new",
    },
    identifiers: [
      { type: "EAN", value: "0195949821943" },
      { type: "MPN", value: "MYN13TH/A" },
    ],
  },
  {
    id: "prod-iphone16pro-512-nat",
    name: "Apple iPhone 16 Pro 512GB Natural Titanium",
    brandName: "Apple",
    model: "MYN53TH/A",
    attributes: {
      storage_capacity: "512GB",
      ram: "8GB",
      color: "Natural Titanium",
      condition: "new",
    },
    identifiers: [
      { type: "EAN", value: "0195949822100" },
      { type: "MPN", value: "MYN53TH/A" },
    ],
  },
];

describe("@pricelens/business — Price Calculation & Offer Comparison", () => {
  it("calculates total_price only when shipping_cost is known", () => {
    const withFreeShipping = calculateOfferTotalPrice("38900", 0, "THB");
    expect(withFreeShipping).toEqual({
      price: "38900.00",
      shippingCost: "0.00",
      shippingKnown: true,
      totalPrice: "38900.00",
      currency: "THB",
    });

    const withPaidShipping = calculateOfferTotalPrice("38900", "45.50", "THB");
    expect(withPaidShipping).toEqual({
      price: "38900.00",
      shippingCost: "45.50",
      shippingKnown: true,
      totalPrice: "38945.50",
      currency: "THB",
    });

    const withUnknownShipping = calculateOfferTotalPrice("38790", null, "THB");
    expect(withUnknownShipping).toEqual({
      price: "38790.00",
      shippingCost: null,
      shippingKnown: false,
      totalPrice: null,
      currency: "THB",
    });
  });

  it("never claims an offer with unknown shipping is cheapest by verified total price", () => {
    const offers = annotateAndSortOffers(
      [
        {
          id: "offer-advice-unknown-ship",
          merchant: {
            id: "m1",
            name: "Advice IT",
            slug: "advice-it",
            logoUrl: null,
            verificationStatus: "verified",
          },
          title: "iPhone 16 Pro 256GB",
          price: "38790.00",
          shippingCost: null,
          totalPrice: null,
          currency: "THB",
          availabilityStatus: "in_stock",
          condition: "new",
          productUrl: "https://advice.co.th/p/1",
          lastCheckedAt: new Date("2026-11-16T08:00:00Z"),
        },
        {
          id: "offer-banana-free-ship",
          merchant: {
            id: "m2",
            name: "Banana IT",
            slug: "banana-it",
            logoUrl: null,
            verificationStatus: "verified",
          },
          title: "iPhone 16 Pro 256GB",
          price: "38900.00",
          shippingCost: "0.00",
          totalPrice: "38900.00",
          currency: "THB",
          availabilityStatus: "in_stock",
          condition: "new",
          productUrl: "https://bnn.in.th/p/1",
          lastCheckedAt: new Date("2026-11-16T08:00:00Z"),
        },
      ],
      "total_price_asc",
    );

    // When sorted by total_price_asc, verified total price ranks FIRST (unknown shipping is last)
    expect(offers[0]?.id).toBe("offer-banana-free-ship");
    expect(offers[0]?.isCheapestByVerifiedTotalPrice).toBe(true);
    expect(offers[0]?.isCheapestByProductPrice).toBe(false);

    expect(offers[1]?.id).toBe("offer-advice-unknown-ship");
    expect(offers[1]?.isCheapestByProductPrice).toBe(true);
    expect(offers[1]?.isCheapestByVerifiedTotalPrice).toBe(false);
  });
});

describe("@pricelens/business — Deterministic Product Matching Engine", () => {
  it("auto-matches Priority 1 (Exact EAN/GTIN) with confidence 100", () => {
    const res = matchProductDeterministically(
      {
        externalProductId: "EXT-1",
        title: "Apple iPhone 16 Pro (256GB) Natural Titanium",
        ean: "0195949821943",
      },
      SAMPLE_CATALOG,
    );

    expect(res.decision).toBe("auto_matched");
    expect(res.matchedProductId).toBe("prod-iphone16pro-256-nat");
    expect(res.confidenceScore).toBe(100);
  });

  it("auto-matches Priority 2 (Exact MPN + Brand) with confidence 95", () => {
    const res = matchProductDeterministically(
      {
        externalProductId: "EXT-2",
        title: "Apple iPhone 16 Pro 512GB Natural Titanium",
        brandName: "Apple",
        mpn: "MYN53TH/A",
      },
      SAMPLE_CATALOG,
    );

    expect(res.decision).toBe("auto_matched");
    expect(res.matchedProductId).toBe("prod-iphone16pro-512-nat");
    expect(res.confidenceScore).toBe(95);
  });

  it("refuses to merge different capacities (256GB vs 1TB) or colors", () => {
    const differentStorage = matchProductDeterministically(
      {
        externalProductId: "EXT-1TB",
        title: "Apple iPhone 16 Pro 1TB Natural Titanium",
        brandName: "Apple",
        attributes: {
          storage_capacity: "1TB",
          color: "Natural Titanium",
        },
      },
      SAMPLE_CATALOG,
    );

    expect(differentStorage.decision).toBe("unmatched");
    expect(differentStorage.matchedProductId).toBeNull();
  });

  it("routes title-only similarity matches (without GTIN/MPN/Model) to Admin Review Queue", () => {
    const titleOnly = matchProductDeterministically(
      {
        externalProductId: "EXT-TITLE-ONLY",
        title: "Apple iPhone 16 Pro 256GB Natural Titanium ประกันศูนย์ไทย",
        brandName: "Apple",
        attributes: {
          storage_capacity: "256GB",
          color: "Natural Titanium",
        },
      },
      SAMPLE_CATALOG,
    );

    expect(titleOnly.decision).toBe("needs_review");
    expect(titleOnly.matchedProductId).toBe("prod-iphone16pro-256-nat");
    expect(titleOnly.confidenceScore).toBeLessThan(90);
    expect(titleOnly.matchingReasons).toContain(
      "MISSING_HARD_IDENTIFIER_REQUIRES_ADMIN_REVIEW",
    );
  });
});

describe("@pricelens/business — Price History & Alert Deduplication", () => {
  it("returns honest insufficient_data state when fewer than 2 daily snapshots exist", () => {
    const emptyHistory = analyzePriceHistory([], "38900.00");
    expect(emptyHistory.hasSufficientData).toBe(false);
    expect(emptyHistory.buyingSignal.recommendation).toBe("insufficient_data");
    expect(emptyHistory.dailySeries).toEqual([]);
  });

  it("triggers price alert when in-stock price <= targetPrice and suppresses duplicates within cooldown", () => {
    const now = new Date("2026-11-16T10:00:00Z");
    const offers = [
      {
        offerId: "off-1",
        merchantName: "Banana IT",
        price: "36900.00",
        currency: "THB",
        availabilityStatus: "in_stock" as const,
        status: "active",
      },
    ];

    const firstTrigger = evaluatePriceAlertCondition(
      {
        alertId: "al-1",
        userId: "u-1",
        productId: "p-1",
        targetPrice: "37500.00",
        currency: "THB",
        isActive: true,
        lastNotifiedAt: null,
      },
      "Samsung Galaxy S24 Ultra 256GB",
      offers,
      now,
    );
    expect(firstTrigger.shouldNotify).toBe(true);
    expect(firstTrigger.status).toBe("triggered");

    const duplicateTrigger = evaluatePriceAlertCondition(
      {
        alertId: "al-1",
        userId: "u-1",
        productId: "p-1",
        targetPrice: "37500.00",
        currency: "THB",
        isActive: true,
        lastNotifiedAt: new Date("2026-11-16T08:00:00Z"), // 2 hours ago
      },
      "Samsung Galaxy S24 Ultra 256GB",
      offers,
      now,
    );
    expect(duplicateTrigger.shouldNotify).toBe(false);
    expect(duplicateTrigger.status).toBe("suppressed_duplicate");
  });
});
