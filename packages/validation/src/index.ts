import { z } from "zod";
import {
  AVAILABILITY_STATUSES,
  DATA_SOURCE_STATUSES,
  DATA_SOURCE_TYPES,
  HISTORY_PERIODS,
  IDENTIFIER_TYPES,
  MATCH_REVIEW_STATUSES,
  MERCHANT_STATUSES,
  MERCHANT_VERIFICATION_STATUSES,
  OFFER_SORT_OPTIONS,
  PRODUCT_CONDITIONS,
  PRODUCT_SORT_OPTIONS,
  PRODUCT_STATUSES,
  SUPPORTED_CURRENCIES,
  toDecimalString,
} from "@pricelens/shared";

// ============================================================================
// Common Primitives
// ============================================================================

export const uuidSchema = z.string().uuid("ต้องเป็นรหัส UUID ที่ถูกต้อง");

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, "รูปแบบ slug ไม่ถูกต้อง");

export const safeHttpUrlSchema = z
  .string()
  .trim()
  .url("ต้องเป็น URL ที่ถูกต้อง")
  .refine((val) => {
    try {
      const parsed = new URL(val);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }, "อนุญาตเฉพาะโปรโตคอล http:// หรือ https:// เท่านั้น");

export const currencySchema = z.enum(SUPPORTED_CURRENCIES, {
  errorMap: () => ({ message: "รองรับเฉพาะสกุลเงิน THB เท่านั้นในขณะนี้" }),
});

export const nonNegativeDecimalSchema = z
  .union([z.number(), z.string()])
  .transform((val, ctx) => {
    try {
      const dec = toDecimalString(val);
      if (Number(dec) < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ราคาต้องไม่ติดลบ",
        });
        return z.NEVER;
      }
      return dec;
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "รูปแบบตัวเลขราคาไม่ถูกต้อง",
      });
      return z.NEVER;
    }
  });

export const positiveDecimalSchema = nonNegativeDecimalSchema.refine(
  (val) => Number(val) > 0,
  "ราคาต้องมากกว่า 0",
);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================================
// Public Discovery & Comparison Query Schemas
// ============================================================================

export const productSearchQuerySchema = paginationQuerySchema
  .extend({
    q: z.string().trim().max(200).optional(),
    categorySlug: z.string().trim().max(120).optional(),
    brandSlug: z.string().trim().max(120).optional(),
    merchantSlug: z.string().trim().max(120).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    sort: z.enum(PRODUCT_SORT_OPTIONS).default("popularity"),
  })
  .refine(
    (data) =>
      data.minPrice === undefined ||
      data.maxPrice === undefined ||
      data.minPrice <= data.maxPrice,
    {
      message: "minPrice ต้องน้อยกว่าหรือเท่ากับ maxPrice",
      path: ["minPrice"],
    },
  );

export const offerListQuerySchema = z.object({
  sort: z.enum(OFFER_SORT_OPTIONS).default("price_asc"),
  inStockOnly: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => v === true || v === "true")
    .default(false),
});

export const priceHistoryQuerySchema = z.object({
  period: z.enum(HISTORY_PERIODS).default("30d"),
});

// ============================================================================
// User API Schemas (Watchlist, Price Alerts, Account)
// ============================================================================

export const createWatchlistSchema = z.object({
  productId: uuidSchema,
});

export const createPriceAlertSchema = z.object({
  productId: uuidSchema,
  targetPrice: positiveDecimalSchema,
  currency: currencySchema.default("THB"),
});

export const updatePriceAlertSchema = z
  .object({
    targetPrice: positiveDecimalSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.targetPrice !== undefined || d.isActive !== undefined, {
    message: "ต้องระบุ targetPrice หรือ isActive อย่างน้อย 1 ค่า",
  });

export const deleteAccountSchema = z.object({
  confirm: z.literal("DELETE", {
    errorMap: () => ({ message: "กรุณาพิมพ์ DELETE เพื่อยืนยันการลบบัญชี" }),
  }),
});

// ============================================================================
// Admin API Schemas
// ============================================================================

export const productIdentifierInputSchema = z.object({
  type: z.enum(IDENTIFIER_TYPES),
  value: z.string().trim().min(2).max(128),
  sourceId: uuidSchema.nullish(),
});

export const productAttributesSchema = z
  .object({
    color: z.string().trim().min(1).optional(),
    size: z.string().trim().min(1).optional(),
    storage_capacity: z.string().trim().min(1).optional(),
    ram: z.string().trim().min(1).optional(),
    cpu: z.string().trim().min(1).optional(),
    gpu: z.string().trim().min(1).optional(),
    condition: z.enum(PRODUCT_CONDITIONS).optional(),
    variant: z.string().trim().min(1).optional(),
    is_demo: z.boolean().optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean(), z.undefined()]));

export const createProductSchema = z.object({
  categoryId: uuidSchema,
  brandId: uuidSchema,
  name: z.string().trim().min(2).max(300),
  slug: slugSchema.optional(),
  model: z.string().trim().max(120).nullish(),
  description: z.string().trim().max(5000).nullish(),
  imageUrl: safeHttpUrlSchema.nullish(),
  attributes: productAttributesSchema.default({}),
  status: z.enum(PRODUCT_STATUSES).default("active"),
  identifiers: z.array(productIdentifierInputSchema).default([]),
});

export const updateProductSchema = createProductSchema.partial();

export const createCategorySchema = z.object({
  parentId: uuidSchema.nullish(),
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
});

export const createBrandSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema.optional(),
});

export const createMerchantSchema = z.object({
  name: z.string().trim().min(1).max(150),
  slug: slugSchema.optional(),
  website: safeHttpUrlSchema,
  logoUrl: safeHttpUrlSchema.nullish(),
  verificationStatus: z.enum(MERCHANT_VERIFICATION_STATUSES).default("unknown"),
  status: z.enum(MERCHANT_STATUSES).default("active"),
});

const FORBIDDEN_SECRET_KEYS = [
  "apikey",
  "api_key",
  "secret",
  "password",
  "token",
  "private_key",
  "access_token",
];

export const createDataSourceSchema = z.object({
  name: z.string().trim().min(2).max(150),
  sourceType: z.enum(DATA_SOURCE_TYPES),
  configuration: z
    .record(z.unknown())
    .default({})
    .refine(
      (cfg) =>
        !Object.keys(cfg).some((key) =>
          FORBIDDEN_SECRET_KEYS.includes(key.toLowerCase()),
        ),
      "ห้ามเก็บ API key, token หรือรหัสลับแบบ plaintext ใน configuration (ให้ใช้ตัวแปรสภาพแวดล้อมแทน)",
    ),
  status: z.enum(DATA_SOURCE_STATUSES).default("active"),
});

// ============================================================================
// Ingestion & Product Matching Schemas
// ============================================================================

export const rawSourceRecordSchema = z.object({
  externalProductId: z.string().trim().min(1).max(200),
  merchantName: z.string().trim().min(1).max(150),
  merchantSlug: z.string().trim().min(1).max(150).optional(),
  merchantWebsite: safeHttpUrlSchema,
  merchantVerified: z.boolean().nullish(),
  title: z.string().trim().min(2).max(500),
  brandName: z.string().trim().min(1).max(120).nullish(),
  categoryName: z.string().trim().min(1).max(120).nullish(),
  model: z.string().trim().max(120).nullish(),
  gtin: z.string().trim().max(64).nullish(),
  ean: z.string().trim().max(64).nullish(),
  upc: z.string().trim().max(64).nullish(),
  mpn: z.string().trim().max(120).nullish(),
  sku: z.string().trim().max(120).nullish(),
  price: positiveDecimalSchema,
  shippingCost: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((val, ctx) => {
      if (val === null || val === undefined || String(val).trim() === "") {
        return null;
      }
      try {
        const dec = toDecimalString(val);
        if (Number(dec) < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "shippingCost ต้องไม่ติดลบ",
          });
          return z.NEVER;
        }
        return dec;
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "shippingCost ไม่ถูกต้อง",
        });
        return z.NEVER;
      }
    }),
  currency: currencySchema,
  availabilityStatus: z.enum(AVAILABILITY_STATUSES).default("unknown"),
  condition: z.enum(PRODUCT_CONDITIONS).default("new"),
  productUrl: safeHttpUrlSchema,
  affiliateUrl: safeHttpUrlSchema.nullish(),
  imageUrl: safeHttpUrlSchema.nullish(),
  attributes: productAttributesSchema.optional(),
  sourceUpdatedAt: z.string().datetime({ offset: true }).nullish(),
});

export const importOffersRequestSchema = z
  .object({
    sourceId: uuidSchema,
    format: z.enum(["csv", "json"]).default("json"),
    csvContent: z.string().min(1).optional(),
    records: z.array(z.record(z.unknown())).optional(),
  })
  .refine(
    (data) =>
      (data.format === "csv" && Boolean(data.csvContent)) ||
      (data.format === "json" && Array.isArray(data.records) && data.records.length > 0),
    {
      message: "ต้องระบุ csvContent เมื่อ format='csv' หรือระบุ records เมื่อ format='json'",
    },
  );

export const matchCandidateListQuerySchema = paginationQuerySchema.extend({
  reviewStatus: z.enum(MATCH_REVIEW_STATUSES).optional(),
});

export const approveMatchCandidateSchema = z.object({
  productId: uuidSchema.optional(),
  createNewProduct: z.boolean().default(false),
  categoryId: uuidSchema.optional(),
  brandId: uuidSchema.optional(),
});

export const rejectMatchCandidateSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;
export type OfferListQuery = z.infer<typeof offerListQuerySchema>;
export type PriceHistoryQuery = z.infer<typeof priceHistoryQuerySchema>;
export type RawSourceRecordInput = z.input<typeof rawSourceRecordSchema>;
export type ValidatedSourceRecord = z.output<typeof rawSourceRecordSchema>;
