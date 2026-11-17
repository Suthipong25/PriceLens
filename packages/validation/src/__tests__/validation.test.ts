import { describe, expect, it } from "vitest";
import {
  createDataSourceSchema,
  productSearchQuerySchema,
  rawSourceRecordSchema,
  safeHttpUrlSchema,
} from "../index.js";

describe("@pricelens/validation", () => {
  it("distinguishes free shipping (0) from unknown shipping (null/empty)", () => {
    const baseRecord = {
      externalProductId: "EXT-100",
      merchantName: "Banana IT",
      merchantWebsite: "https://www.bnn.in.th",
      title: "Apple iPhone 16 Pro 256GB Natural Titanium",
      price: "38900",
      currency: "THB",
      productUrl: "https://www.bnn.in.th/th/p/iphone-16-pro",
    };

    const withFreeShipping = rawSourceRecordSchema.parse({
      ...baseRecord,
      shippingCost: 0,
    });
    expect(withFreeShipping.shippingCost).toBe("0.00");

    const withUnknownShipping = rawSourceRecordSchema.parse({
      ...baseRecord,
      shippingCost: null,
    });
    expect(withUnknownShipping.shippingCost).toBeNull();

    const withEmptyStringShipping = rawSourceRecordSchema.parse({
      ...baseRecord,
      shippingCost: "   ",
    });
    expect(withEmptyStringShipping.shippingCost).toBeNull();
  });

  it("rejects unsupported currencies and unsafe URLs", () => {
    expect(() =>
      safeHttpUrlSchema.parse("javascript:alert(document.cookie)"),
    ).toThrow();

    const invalidCurrency = rawSourceRecordSchema.safeParse({
      externalProductId: "EXT-101",
      merchantName: "Test Shop",
      merchantWebsite: "https://example.com",
      title: "Sony WH-1000XM5",
      price: "299.99",
      currency: "USD",
      productUrl: "https://example.com/p/xm5",
    });
    expect(invalidCurrency.success).toBe(false);
  });

  it("prevents storing plaintext secrets in data_sources.configuration", () => {
    const badSource = createDataSourceSchema.safeParse({
      name: "Affiliate API",
      sourceType: "affiliate_api",
      configuration: {
        endpoint: "https://api.example.com/feed",
        api_key: "sk_live_secret123",
      },
    });
    expect(badSource.success).toBe(false);

    const goodSource = createDataSourceSchema.safeParse({
      name: "Affiliate API",
      sourceType: "affiliate_api",
      configuration: {
        endpoint: "https://api.example.com/feed",
        secretEnvVarName: "INVOLVE_ASIA_API_SECRET",
      },
    });
    expect(goodSource.success).toBe(true);
  });

  it("validates price range filters in product search", () => {
    const invalidRange = productSearchQuerySchema.safeParse({
      minPrice: 50000,
      maxPrice: 10000,
    });
    expect(invalidRange.success).toBe(false);

    const validRange = productSearchQuerySchema.safeParse({
      minPrice: "10000",
      maxPrice: "50000",
      sort: "total_price_asc",
    });
    expect(validRange.success).toBe(true);
  });
});
