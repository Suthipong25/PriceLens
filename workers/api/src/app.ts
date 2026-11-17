import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import type { ZodType, ZodTypeDef } from "zod";
import {
  analyzePriceHistory,
  annotateAndSortOffers,
} from "@pricelens/business";
import {
  affiliateClicks,
  auditLogs,
  brands,
  categories,
  dataSources,
  ingestionJobs,
  merchants,
  notifications,
  offers,
  priceAlerts,
  priceSnapshots,
  productIdentifiers,
  productMatchCandidates,
  products,
  users,
  watchlists,
  type PriceLensDb,
} from "@pricelens/database";
import {
  executeIngestionJob,
  normalizeSourceRecord,
  recordPriceSnapshotIfNeeded,
  upsertMerchantAndOffer,
  validateSourceRecord,
} from "@pricelens/ingestion";
import { HISTORY_PERIOD_DAYS, slugify } from "@pricelens/shared";
import {
  approveMatchCandidateSchema,
  createBrandSchema,
  createCategorySchema,
  createDataSourceSchema,
  createMerchantSchema,
  createPriceAlertSchema,
  createProductSchema,
  createWatchlistSchema,
  deleteAccountSchema,
  importOffersRequestSchema,
  matchCandidateListQuerySchema,
  offerListQuerySchema,
  paginationQuerySchema,
  priceHistoryQuerySchema,
  productSearchQuerySchema,
  rejectMatchCandidateSchema,
  updatePriceAlertSchema,
  updateProductSchema,
  uuidSchema,
} from "@pricelens/validation";
import {
  createAuth,
  resolveAuthenticatedUser,
  type AuthenticatedUser,
} from "./auth.js";
import { openApiSpec } from "./openapi.js";

type AppVariables = {
  user: AuthenticatedUser | null;
  requestId: string;
};

export interface CreateApiAppOptions {
  db: PriceLensDb;
  rateLimitMaxRequestsPerMinute?: number;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function createApiApp(options: CreateApiAppOptions) {
  const { db, rateLimitMaxRequestsPerMinute = 300 } = options;
  const auth = createAuth(db);
  const app = new Hono<{ Variables: AppVariables }>();

  // Sliding-window rate limit map per IP
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();

  // --------------------------------------------------------------------------
  // Global Middleware: Request ID, CORS, Rate Limiting, Auth Session Resolution
  // --------------------------------------------------------------------------
  app.use("*", async (c, next) => {
    const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);

    const ip =
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for") ??
      "127.0.0.1";
    const now = Date.now();
    const bucket = rateBuckets.get(ip);

    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    } else {
      bucket.count++;
      if (bucket.count > rateLimitMaxRequestsPerMinute) {
        c.header(
          "Retry-After",
          String(Math.ceil((bucket.resetAt - now) / 1000)),
        );
        return c.json(
          {
            error: {
              code: "RATE_LIMITED",
              message: "ส่งคำขอเกินจำนวนที่กำหนด กรุณาลองใหม่อีกครั้งในภายหลัง",
              details: [],
              requestId,
            },
          },
          429,
        );
      }
    }

    await next();
  });

  app.use(
    "*",
    cors({
      origin: (origin) => origin || "http://localhost:3000",
      credentials: true,
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // Better Auth handler (/api/auth/*)
  app.on(["GET", "POST"], "/api/auth/*", (c) => {
    return auth.handler(c.req.raw);
  });

  // Resolve user session for all /api/v1/* routes
  app.use("/api/v1/*", async (c, next) => {
    const user = await resolveAuthenticatedUser(db, auth, c.req.raw);
    c.set("user", user);
    await next();
  });

  // Global error handler — never leaks stack traces or secrets
  app.onError((err, c) => {
    const requestId = c.get("requestId") ?? "req_unknown";
    return c.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง",
          details:
            process.env.NODE_ENV === "development"
              ? [{ issue: err.message }]
              : [],
          requestId,
        },
      },
      500,
    );
  });

  app.notFound((c) => {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "ไม่พบ Endpoint หรือข้อมูลที่ร้องขอ",
          details: [],
          requestId: c.get("requestId") ?? "req_unknown",
        },
      },
      404,
    );
  });

  type AppContext = Context<{ Variables: AppVariables }>;

  function validateOrError<T>(
    c: AppContext,
    schema: ZodType<T, ZodTypeDef, unknown>,
    input: unknown,
  ): { ok: true; data: T } | { ok: false; response: Response } {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        response: c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "ข้อมูลคำขอไม่ถูกต้องตามรูปแบบที่กำหนด",
              details: parsed.error.issues.map((i) => ({
                field: i.path.join(".") || "root",
                issue: i.message,
              })),
              requestId: c.get("requestId"),
            },
          },
          400,
        ),
      };
    }
    return { ok: true, data: parsed.data };
  }

  // --------------------------------------------------------------------------
  // OpenAPI & Health
  // --------------------------------------------------------------------------
  app.get("/api/v1/openapi.json", (c) => c.json(openApiSpec));
  app.get("/api/v1/health", (c) =>
    c.json({
      data: { status: "ok", service: "pricelens-api", version: "1.0.0" },
      meta: { timestamp: new Date().toISOString() },
    }),
  );

  // --------------------------------------------------------------------------
  // Public API: Categories, Brands, Merchants
  // --------------------------------------------------------------------------
  app.get("/api/v1/categories", async (c) => {
    const allCategories = await db.select().from(categories);
    const activeProducts = await db
      .select({ id: products.id, categoryId: products.categoryId })
      .from(products)
      .where(eq(products.status, "active"));

    const countByCat = new Map<string, number>();
    for (const p of activeProducts) {
      countByCat.set(p.categoryId, (countByCat.get(p.categoryId) ?? 0) + 1);
    }

    const enriched = allCategories.map((cat) => ({
      ...cat,
      productCount: countByCat.get(cat.id) ?? 0,
    }));

    return c.json({
      data: enriched,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  app.get("/api/v1/brands", async (c) => {
    const allBrands = await db.select().from(brands);
    const activeProducts = await db
      .select({ id: products.id, brandId: products.brandId })
      .from(products)
      .where(eq(products.status, "active"));

    const countByBrand = new Map<string, number>();
    for (const p of activeProducts) {
      countByBrand.set(p.brandId, (countByBrand.get(p.brandId) ?? 0) + 1);
    }

    const enriched = allBrands.map((b) => ({
      ...b,
      productCount: countByBrand.get(b.id) ?? 0,
    }));

    return c.json({
      data: enriched,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  app.get("/api/v1/merchants", async (c) => {
    const allMerchants = await db
      .select()
      .from(merchants)
      .where(eq(merchants.status, "active"));
    const activeOffers = await db
      .select({ id: offers.id, merchantId: offers.merchantId })
      .from(offers)
      .where(eq(offers.status, "active"));

    const countByMerchant = new Map<string, number>();
    for (const o of activeOffers) {
      countByMerchant.set(
        o.merchantId,
        (countByMerchant.get(o.merchantId) ?? 0) + 1,
      );
    }

    return c.json({
      data: allMerchants.map((m) => ({
        ...m,
        activeOfferCount: countByMerchant.get(m.id) ?? 0,
      })),
      meta: { timestamp: new Date().toISOString() },
    });
  });

  // --------------------------------------------------------------------------
  // Public API: Product Discovery (GET /api/v1/products)
  // --------------------------------------------------------------------------
  app.get("/api/v1/products", async (c) => {
    const rawQuery = c.req.query();
    const val = validateOrError(c, productSearchQuerySchema, rawQuery);
    if (!val.ok) return val.response;
    const query = val.data;

    const allProducts = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        model: products.model,
        description: products.description,
        imageUrl: products.imageUrl,
        attributes: products.attributes,
        status: products.status,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        category: {
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          parentId: categories.parentId,
        },
        brand: {
          id: brands.id,
          name: brands.name,
          slug: brands.slug,
        },
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(eq(products.status, "active"));

    const allIdentifiers = await db.select().from(productIdentifiers);
    const allOffers = await db
      .select({
        id: offers.id,
        productId: offers.productId,
        merchantId: offers.merchantId,
        merchantSlug: merchants.slug,
        merchantName: merchants.name,
        price: offers.price,
        shippingCost: offers.shippingCost,
        totalPrice: offers.totalPrice,
        currency: offers.currency,
        availabilityStatus: offers.availabilityStatus,
        lastCheckedAt: offers.lastCheckedAt,
      })
      .from(offers)
      .innerJoin(merchants, eq(offers.merchantId, merchants.id))
      .where(eq(offers.status, "active"));

    const allClicks = await db
      .select({ offerId: affiliateClicks.offerId })
      .from(affiliateClicks);

    // Map categories for parent-child matching
    const allCats = await db.select().from(categories);
    let allowedCategoryIds: Set<string> | null = null;
    if (query.categorySlug) {
      const targetCat = allCats.find((cat) => cat.slug === query.categorySlug);
      if (targetCat) {
        allowedCategoryIds = new Set([
          targetCat.id,
          ...allCats
            .filter((sub) => sub.parentId === targetCat.id)
            .map((sub) => sub.id),
        ]);
      } else {
        allowedCategoryIds = new Set();
      }
    }

    const clicksByOffer = new Map<string, number>();
    for (const cl of allClicks) {
      clicksByOffer.set(cl.offerId, (clicksByOffer.get(cl.offerId) ?? 0) + 1);
    }

    const identifiersByProduct = new Map<
      string,
      Array<{ type: string; value: string }>
    >();
    for (const idRow of allIdentifiers) {
      const arr = identifiersByProduct.get(idRow.productId) ?? [];
      arr.push({ type: idRow.type, value: idRow.value });
      identifiersByProduct.set(idRow.productId, arr);
    }

    const offersByProduct = new Map<string, typeof allOffers>();
    for (const o of allOffers) {
      const arr = offersByProduct.get(o.productId) ?? [];
      arr.push(o);
      offersByProduct.set(o.productId, arr);
    }

    const searchNormalized = query.q?.toLowerCase().trim() ?? "";

    const enriched = allProducts
      .map((p) => {
        const prodOffers = offersByProduct.get(p.id) ?? [];
        const prodIds = identifiersByProduct.get(p.id) ?? [];

        const prices = prodOffers.map((o) => Number(o.price));
        const verifiedTotals = prodOffers
          .filter((o) => o.shippingCost !== null && o.totalPrice !== null)
          .map((o) => Number(o.totalPrice));

        const lowestProductPrice =
          prices.length > 0 ? Math.min(...prices).toFixed(2) : null;
        const lowestVerifiedTotalPrice =
          verifiedTotals.length > 0
            ? Math.min(...verifiedTotals).toFixed(2)
            : null;
        const highestProductPrice =
          prices.length > 0 ? Math.max(...prices).toFixed(2) : null;

        const latestCheckedMs =
          prodOffers.length > 0
            ? Math.max(
                ...prodOffers.map((o) => new Date(o.lastCheckedAt).getTime()),
              )
            : new Date(p.updatedAt).getTime();

        const popularityClicks = prodOffers.reduce(
          (sum, o) => sum + (clicksByOffer.get(o.id) ?? 0),
          0,
        );

        return {
          ...p,
          isDemoData: Boolean(p.attributes.is_demo),
          identifiers: prodIds,
          priceSummary: {
            currency: "THB",
            lowestProductPrice,
            lowestVerifiedTotalPrice,
            highestProductPrice,
            offerCount: prodOffers.length,
            merchantCount: new Set(prodOffers.map((o) => o.merchantId)).size,
            lastCheckedAt: new Date(latestCheckedMs).toISOString(),
          },
          _offers: prodOffers,
          _popularity: popularityClicks,
          _latestCheckedMs: latestCheckedMs,
        };
      })
      .filter((item) => {
        if (allowedCategoryIds && !allowedCategoryIds.has(item.category.id)) {
          return false;
        }
        if (query.brandSlug && item.brand.slug !== query.brandSlug) {
          return false;
        }
        if (
          query.merchantSlug &&
          !item._offers.some((o) => o.merchantSlug === query.merchantSlug)
        ) {
          return false;
        }
        if (query.minPrice !== undefined) {
          if (
            item.priceSummary.lowestProductPrice === null ||
            Number(item.priceSummary.lowestProductPrice) < query.minPrice
          ) {
            return false;
          }
        }
        if (query.maxPrice !== undefined) {
          if (
            item.priceSummary.lowestProductPrice === null ||
            Number(item.priceSummary.lowestProductPrice) > query.maxPrice
          ) {
            return false;
          }
        }
        if (searchNormalized.length > 0) {
          const haystacks = [
            item.name.toLowerCase(),
            item.brand.name.toLowerCase(),
            (item.model ?? "").toLowerCase(),
            ...item.identifiers.map((id) => id.value.toLowerCase()),
          ];
          if (!haystacks.some((h) => h.includes(searchNormalized))) {
            return false;
          }
        }
        return true;
      });

    enriched.sort((a, b) => {
      switch (query.sort) {
        case "price_asc": {
          const pa =
            a.priceSummary.lowestProductPrice !== null
              ? Number(a.priceSummary.lowestProductPrice)
              : Number.POSITIVE_INFINITY;
          const pb =
            b.priceSummary.lowestProductPrice !== null
              ? Number(b.priceSummary.lowestProductPrice)
              : Number.POSITIVE_INFINITY;
          return pa - pb;
        }
        case "total_price_asc": {
          const ta =
            a.priceSummary.lowestVerifiedTotalPrice !== null
              ? Number(a.priceSummary.lowestVerifiedTotalPrice)
              : Number.POSITIVE_INFINITY;
          const tb =
            b.priceSummary.lowestVerifiedTotalPrice !== null
              ? Number(b.priceSummary.lowestVerifiedTotalPrice)
              : Number.POSITIVE_INFINITY;
          if (ta !== tb) return ta - tb;
          return (
            Number(a.priceSummary.lowestProductPrice ?? Infinity) -
            Number(b.priceSummary.lowestProductPrice ?? Infinity)
          );
        }
        case "price_desc": {
          const pa =
            a.priceSummary.lowestProductPrice !== null
              ? Number(a.priceSummary.lowestProductPrice)
              : -1;
          const pb =
            b.priceSummary.lowestProductPrice !== null
              ? Number(b.priceSummary.lowestProductPrice)
              : -1;
          return pb - pa;
        }
        case "updated_desc":
          return b._latestCheckedMs - a._latestCheckedMs;
        case "popularity":
        default:
          if (b._popularity !== a._popularity) {
            return b._popularity - a._popularity;
          }
          return a.name.localeCompare(b.name);
      }
    });

    const totalItems = enriched.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));
    const offset = (query.page - 1) * query.limit;
    const paged = enriched
      .slice(offset, offset + query.limit)
      .map(({ _offers, _popularity, _latestCheckedMs, ...publicItem }) => publicItem);

    return c.json({
      data: paged,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages,
        hasNextPage: query.page < totalPages,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  });

  // Helper to find canonical product by UUID or slug
  async function findProductByIdOrSlug(idOrSlug: string) {
    const condition = isUuid(idOrSlug)
      ? eq(products.id, idOrSlug)
      : eq(products.slug, idOrSlug);

    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        model: products.model,
        description: products.description,
        imageUrl: products.imageUrl,
        attributes: products.attributes,
        status: products.status,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        category: {
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
        },
        brand: {
          id: brands.id,
          name: brands.name,
          slug: brands.slug,
        },
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(condition)
      .limit(1);

    return rows[0] ?? null;
  }

  // --------------------------------------------------------------------------
  // Public API: Product Detail (GET /api/v1/products/:id)
  // --------------------------------------------------------------------------
  app.get("/api/v1/products/:id", async (c) => {
    const idOrSlug = c.req.param("id");
    const product = await findProductByIdOrSlug(idOrSlug);
    if (!product) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "ไม่พบสินค้าที่ระบุ",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        404,
      );
    }

    const identifiers = await db
      .select({
        id: productIdentifiers.id,
        type: productIdentifiers.type,
        value: productIdentifiers.value,
      })
      .from(productIdentifiers)
      .where(eq(productIdentifiers.productId, product.id));

    const prodOffers = await db
      .select()
      .from(offers)
      .where(
        and(eq(offers.productId, product.id), eq(offers.status, "active")),
      );

    const offerIds = prodOffers.map((o) => o.id);
    const snapshots =
      offerIds.length > 0
        ? await db
            .select()
            .from(priceSnapshots)
            .where(inArray(priceSnapshots.offerId, offerIds))
        : [];

    const prices = prodOffers.map((o) => Number(o.price));
    const verifiedTotals = prodOffers
      .filter((o) => o.shippingCost !== null && o.totalPrice !== null)
      .map((o) => Number(o.totalPrice));

    const lowestProductPrice =
      prices.length > 0 ? Math.min(...prices).toFixed(2) : null;
    const lowestVerifiedTotalPrice =
      verifiedTotals.length > 0
        ? Math.min(...verifiedTotals).toFixed(2)
        : null;

    const historyAnalysis = analyzePriceHistory(snapshots, lowestProductPrice);

    // Related product suggestions in the same category or brand
    const relatedRows = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        model: products.model,
        imageUrl: products.imageUrl,
        attributes: products.attributes,
      })
      .from(products)
      .where(
        and(
          eq(products.categoryId, product.category.id),
          eq(products.status, "active"),
        ),
      )
      .limit(5);

    const suggestions = relatedRows.filter((r) => r.id !== product.id).slice(0, 4);

    return c.json({
      data: {
        ...product,
        isDemoData: Boolean(product.attributes.is_demo),
        identifiers,
        priceSummary: {
          currency: "THB",
          lowestProductPrice,
          lowestVerifiedTotalPrice,
          offerCount: prodOffers.length,
          inStockOfferCount: prodOffers.filter(
            (o) => o.availabilityStatus === "in_stock",
          ).length,
          lastCheckedAt:
            prodOffers.length > 0
              ? new Date(
                  Math.max(
                    ...prodOffers.map((o) => new Date(o.lastCheckedAt).getTime()),
                  ),
                ).toISOString()
              : product.updatedAt.toISOString(),
        },
        buyingSignal: historyAnalysis.buyingSignal,
        suggestions,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  });

  // --------------------------------------------------------------------------
  // Public API: Product Offers Comparison (GET /api/v1/products/:id/offers)
  // --------------------------------------------------------------------------
  app.get("/api/v1/products/:id/offers", async (c) => {
    const idOrSlug = c.req.param("id");
    const product = await findProductByIdOrSlug(idOrSlug);
    if (!product) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "ไม่พบสินค้าที่ระบุ",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        404,
      );
    }

    const val = validateOrError(c, offerListQuerySchema, c.req.query());
    if (!val.ok) return val.response;
    const { sort, inStockOnly } = val.data;

    const rawOffers = await db
      .select({
        id: offers.id,
        title: offers.title,
        price: offers.price,
        shippingCost: offers.shippingCost,
        totalPrice: offers.totalPrice,
        currency: offers.currency,
        availabilityStatus: offers.availabilityStatus,
        condition: offers.condition,
        productUrl: offers.productUrl,
        affiliateUrl: offers.affiliateUrl,
        lastCheckedAt: offers.lastCheckedAt,
        merchant: {
          id: merchants.id,
          name: merchants.name,
          slug: merchants.slug,
          logoUrl: merchants.logoUrl,
          verificationStatus: merchants.verificationStatus,
        },
      })
      .from(offers)
      .innerJoin(merchants, eq(offers.merchantId, merchants.id))
      .where(
        and(eq(offers.productId, product.id), eq(offers.status, "active")),
      );

    const filtered = inStockOnly
      ? rawOffers.filter((o) => o.availabilityStatus === "in_stock")
      : rawOffers;

    const annotated = annotateAndSortOffers(filtered, sort);

    return c.json({
      data: annotated,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  // --------------------------------------------------------------------------
  // Public API: Product Price History (GET /api/v1/products/:id/history)
  // --------------------------------------------------------------------------
  app.get("/api/v1/products/:id/history", async (c) => {
    const idOrSlug = c.req.param("id");
    const product = await findProductByIdOrSlug(idOrSlug);
    if (!product) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "ไม่พบสินค้าที่ระบุ",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        404,
      );
    }

    const val = validateOrError(c, priceHistoryQuerySchema, c.req.query());
    if (!val.ok) return val.response;
    const { period } = val.data;

    const days = HISTORY_PERIOD_DAYS[period];
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const prodOffers = await db
      .select({ id: offers.id, price: offers.price })
      .from(offers)
      .where(
        and(eq(offers.productId, product.id), eq(offers.status, "active")),
      );

    const offerIds = prodOffers.map((o) => o.id);
    const currentLowestPrice =
      prodOffers.length > 0
        ? Math.min(...prodOffers.map((o) => Number(o.price))).toFixed(2)
        : null;

    const snapshots =
      offerIds.length > 0
        ? await db
            .select()
            .from(priceSnapshots)
            .where(
              and(
                inArray(priceSnapshots.offerId, offerIds),
                gte(priceSnapshots.recordedAt, cutoff),
              ),
            )
            .orderBy(desc(priceSnapshots.recordedAt))
        : [];

    const analysis = analyzePriceHistory(snapshots, currentLowestPrice);

    return c.json({
      data: {
        productId: product.id,
        period,
        currency: "THB",
        ...analysis,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  });

  // --------------------------------------------------------------------------
  // Affiliate Outbound Click Tracking (POST & GET /api/v1/offers/:id/click)
  // --------------------------------------------------------------------------
  async function handleOfferClick(c: AppContext, redirect: boolean) {
    const offerId = c.req.param("id") ?? "";
    if (!isUuid(offerId)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "รหัสข้อเสนอ (offerId) ไม่ถูกต้อง",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        400,
      );
    }

    const rows = await db
      .select({
        id: offers.id,
        productUrl: offers.productUrl,
        affiliateUrl: offers.affiliateUrl,
        sourceName: dataSources.name,
        sourceType: dataSources.sourceType,
      })
      .from(offers)
      .innerJoin(dataSources, eq(offers.sourceId, dataSources.id))
      .where(eq(offers.id, offerId))
      .limit(1);

    const offer = rows[0];
    if (!offer) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "ไม่พบข้อเสนอสินค้าที่ระบุ",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        404,
      );
    }

    const user = c.get("user");
    const trackingId = `trk_${crypto.randomUUID().replace(/-/g, "")}`;
    const targetUrl = offer.affiliateUrl ?? offer.productUrl;

    await db.insert(affiliateClicks).values({
      userId: user?.id ?? null,
      offerId: offer.id,
      affiliateSource: offer.affiliateUrl ? offer.sourceType : "direct_merchant",
      trackingId,
    });

    if (redirect) {
      return c.redirect(targetUrl, 302);
    }

    return c.json({
      data: {
        offerId: offer.id,
        trackingId,
        targetUrl,
        isAffiliateLink: Boolean(offer.affiliateUrl),
      },
      meta: { timestamp: new Date().toISOString() },
    });
  }

  app.post("/api/v1/offers/:id/click", (c) => handleOfferClick(c, false));
  app.get("/api/v1/offers/:id/click", (c) => handleOfferClick(c, true));

  // --------------------------------------------------------------------------
  // User API (/api/v1/me/*) — Requires Authenticated User
  // --------------------------------------------------------------------------
  app.use("/api/v1/me/*", async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "กรุณาเข้าสู่ระบบก่อนใช้งานส่วนนี้",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        401,
      );
    }
    await next();
  });

  app.get("/api/v1/me", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "กรุณาเข้าสู่ระบบก่อนใช้งานส่วนนี้",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        401,
      );
    }

    const userWatchlist = await db
      .select({ id: watchlists.id })
      .from(watchlists)
      .where(eq(watchlists.userId, user.id));

    const userAlerts = await db
      .select({ id: priceAlerts.id, isActive: priceAlerts.isActive })
      .from(priceAlerts)
      .where(eq(priceAlerts.userId, user.id));

    return c.json({
      data: {
        ...user,
        stats: {
          watchlistCount: userWatchlist.length,
          totalAlertsCount: userAlerts.length,
          activeAlertsCount: userAlerts.filter((a) => a.isActive).length,
        },
      },
      meta: { timestamp: new Date().toISOString() },
    });
  });

  app.delete("/api/v1/me", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "กรุณาเข้าสู่ระบบก่อนใช้งานส่วนนี้",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        401,
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const val = validateOrError(c, deleteAccountSchema, body);
    if (!val.ok) return val.response;

    await db.delete(users).where(eq(users.id, user.id));

    return c.json({
      data: { deleted: true, userId: user.id },
      meta: { timestamp: new Date().toISOString() },
    });
  });

  app.get("/api/v1/me/watchlist", async (c) => {
    const user = c.get("user")!;
    const items = await db
      .select({
        id: watchlists.id,
        productId: watchlists.productId,
        createdAt: watchlists.createdAt,
        product: {
          id: products.id,
          name: products.name,
          slug: products.slug,
          model: products.model,
          imageUrl: products.imageUrl,
          attributes: products.attributes,
        },
        brand: {
          id: brands.id,
          name: brands.name,
          slug: brands.slug,
        },
      })
      .from(watchlists)
      .innerJoin(products, eq(watchlists.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(eq(watchlists.userId, user.id))
      .orderBy(desc(watchlists.createdAt));

    const prodIds = items.map((i) => i.productId);
    const activeOffers =
      prodIds.length > 0
        ? await db
            .select()
            .from(offers)
            .where(
              and(
                inArray(offers.productId, prodIds),
                eq(offers.status, "active"),
              ),
            )
        : [];

    const enriched = items.map((item) => {
      const pOffers = activeOffers.filter((o) => o.productId === item.productId);
      const lowestPrice =
        pOffers.length > 0
          ? Math.min(...pOffers.map((o) => Number(o.price))).toFixed(2)
          : null;
      return {
        ...item,
        lowestProductPrice: lowestPrice,
        offerCount: pOffers.length,
        currency: "THB",
      };
    });

    return c.json({
      data: enriched,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  app.post("/api/v1/me/watchlist", async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json().catch(() => ({}));
    const val = validateOrError(c, createWatchlistSchema, body);
    if (!val.ok) return val.response;

    const [prod] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, val.data.productId))
      .limit(1);

    if (!prod) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "ไม่พบสินค้าที่ต้องการบันทึก",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        404,
      );
    }

    const existing = await db
      .select()
      .from(watchlists)
      .where(
        and(
          eq(watchlists.userId, user.id),
          eq(watchlists.productId, val.data.productId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return c.json({ data: existing[0], meta: { timestamp: new Date().toISOString() } }, 200);
    }

    const [created] = await db
      .insert(watchlists)
      .values({
        userId: user.id,
        productId: val.data.productId,
      })
      .returning();

    return c.json(
      { data: created, meta: { timestamp: new Date().toISOString() } },
      201,
    );
  });

  app.delete("/api/v1/me/watchlist/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "รหัสไม่ถูกต้อง",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        400,
      );
    }

    const deleted = await db
      .delete(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, user.id)))
      .returning();

    if (deleted.length === 0) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "ไม่พบรายการโปรดที่ต้องการลบ",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        404,
      );
    }

    return c.json({
      data: { deleted: true, id },
      meta: { timestamp: new Date().toISOString() },
    });
  });

  app.get("/api/v1/me/price-alerts", async (c) => {
    const user = c.get("user")!;
    const alerts = await db
      .select({
        id: priceAlerts.id,
        productId: priceAlerts.productId,
        targetPrice: priceAlerts.targetPrice,
        currency: priceAlerts.currency,
        isActive: priceAlerts.isActive,
        lastNotifiedAt: priceAlerts.lastNotifiedAt,
        createdAt: priceAlerts.createdAt,
        updatedAt: priceAlerts.updatedAt,
        product: {
          id: products.id,
          name: products.name,
          slug: products.slug,
          imageUrl: products.imageUrl,
        },
      })
      .from(priceAlerts)
      .innerJoin(products, eq(priceAlerts.productId, products.id))
      .where(eq(priceAlerts.userId, user.id))
      .orderBy(desc(priceAlerts.createdAt));

    const userNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(20);

    return c.json({
      data: {
        alerts,
        recentNotifications: userNotifications,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  });

  app.post("/api/v1/me/price-alerts", async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json().catch(() => ({}));
    const val = validateOrError(c, createPriceAlertSchema, body);
    if (!val.ok) return val.response;

    const [prod] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, val.data.productId))
      .limit(1);

    if (!prod) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "ไม่พบสินค้าที่ต้องการตั้งแจ้งเตือนราคา",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        404,
      );
    }

    const existing = await db
      .select()
      .from(priceAlerts)
      .where(
        and(
          eq(priceAlerts.userId, user.id),
          eq(priceAlerts.productId, val.data.productId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      const [updated] = await db
        .update(priceAlerts)
        .set({
          targetPrice: val.data.targetPrice,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(priceAlerts.id, existing[0].id))
        .returning();

      return c.json({
        data: updated,
        meta: { timestamp: new Date().toISOString() },
      });
    }

    const [created] = await db
      .insert(priceAlerts)
      .values({
        userId: user.id,
        productId: val.data.productId,
        targetPrice: val.data.targetPrice,
        currency: val.data.currency,
        isActive: true,
      })
      .returning();

    return c.json(
      { data: created, meta: { timestamp: new Date().toISOString() } },
      201,
    );
  });

  app.patch("/api/v1/me/price-alerts/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "รหัสการแจ้งเตือนไม่ถูกต้อง",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        400,
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const val = validateOrError(c, updatePriceAlertSchema, body);
    if (!val.ok) return val.response;

    const [updated] = await db
      .update(priceAlerts)
      .set({
        ...(val.data.targetPrice !== undefined
          ? { targetPrice: val.data.targetPrice }
          : {}),
        ...(val.data.isActive !== undefined
          ? { isActive: val.data.isActive }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, user.id)))
      .returning();

    if (!updated) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "ไม่พบรายการแจ้งเตือนราคา",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        404,
      );
    }

    return c.json({
      data: updated,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  app.delete("/api/v1/me/price-alerts/:id", async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "รหัสการแจ้งเตือนไม่ถูกต้อง",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        400,
      );
    }

    const deleted = await db
      .delete(priceAlerts)
      .where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, user.id)))
      .returning();

    if (deleted.length === 0) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "ไม่พบรายการแจ้งเตือนราคา",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        404,
      );
    }

    return c.json({
      data: { deleted: true, id },
      meta: { timestamp: new Date().toISOString() },
    });
  });

  // --------------------------------------------------------------------------
  // Admin API (/api/v1/admin/*) — Requires Authenticated Admin Role
  // --------------------------------------------------------------------------
  app.use("/api/v1/admin/*", async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "กรุณาเข้าสู่ระบบก่อนใช้งาน",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        401,
      );
    }
    if (user.role !== "admin") {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "ต้องใช้สิทธิ์ผู้ดูแลระบบ (Admin) เท่านั้น",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        403,
      );
    }
    await next();
  });

  async function recordAuditLog(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown> = {},
  ) {
    await db.insert(auditLogs).values({
      actorId,
      action,
      entityType,
      entityId,
      metadata,
    });
  }

  app.post("/api/v1/admin/products", async (c) => {
    const admin = c.get("user")!;
    const body = await c.req.json().catch(() => ({}));
    const val = validateOrError(c, createProductSchema, body);
    if (!val.ok) return val.response;
    const input = val.data;

    const productSlug = input.slug ?? slugify(input.name);
    const [created] = await db
      .insert(products)
      .values({
        categoryId: input.categoryId,
        brandId: input.brandId,
        name: input.name,
        slug: productSlug,
        model: input.model ?? null,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        attributes: input.attributes,
        status: input.status,
      })
      .returning();

    if (input.identifiers.length > 0) {
      await db
        .insert(productIdentifiers)
        .values(
          input.identifiers.map((idItem) => ({
            productId: created!.id,
            type: idItem.type,
            value: idItem.value.trim().toUpperCase(),
            sourceId: idItem.sourceId ?? null,
          })),
        )
        .onConflictDoNothing();
    }

    await recordAuditLog(admin.id, "PRODUCT_CREATE", "products", created!.id, {
      name: created!.name,
      slug: created!.slug,
    });

    return c.json(
      { data: created, meta: { timestamp: new Date().toISOString() } },
      201,
    );
  });

  app.patch("/api/v1/admin/products/:id", async (c) => {
    const admin = c.get("user")!;
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "รหัสสินค้าไม่ถูกต้อง",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        400,
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const val = validateOrError(c, updateProductSchema, body);
    if (!val.ok) return val.response;
    const input = val.data;

    const [updated] = await db
      .update(products)
      .set({
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.attributes !== undefined ? { attributes: input.attributes } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    if (!updated) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "ไม่พบสินค้าที่ต้องการแก้ไข",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        404,
      );
    }

    await recordAuditLog(admin.id, "PRODUCT_UPDATE", "products", updated.id, {
      updatedFields: Object.keys(input),
    });

    return c.json({
      data: updated,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  app.post("/api/v1/admin/categories", async (c) => {
    const admin = c.get("user")!;
    const body = await c.req.json().catch(() => ({}));
    const val = validateOrError(c, createCategorySchema, body);
    if (!val.ok) return val.response;

    const [created] = await db
      .insert(categories)
      .values({
        parentId: val.data.parentId ?? null,
        name: val.data.name,
        slug: val.data.slug ?? slugify(val.data.name),
      })
      .returning();

    await recordAuditLog(
      admin.id,
      "CATEGORY_CREATE",
      "categories",
      created!.id,
    );

    return c.json(
      { data: created, meta: { timestamp: new Date().toISOString() } },
      201,
    );
  });

  app.post("/api/v1/admin/brands", async (c) => {
    const admin = c.get("user")!;
    const body = await c.req.json().catch(() => ({}));
    const val = validateOrError(c, createBrandSchema, body);
    if (!val.ok) return val.response;

    const [created] = await db
      .insert(brands)
      .values({
        name: val.data.name,
        slug: val.data.slug ?? slugify(val.data.name),
      })
      .returning();

    await recordAuditLog(admin.id, "BRAND_CREATE", "brands", created!.id);

    return c.json(
      { data: created, meta: { timestamp: new Date().toISOString() } },
      201,
    );
  });

  app.post("/api/v1/admin/merchants", async (c) => {
    const admin = c.get("user")!;
    const body = await c.req.json().catch(() => ({}));
    const val = validateOrError(c, createMerchantSchema, body);
    if (!val.ok) return val.response;

    const [created] = await db
      .insert(merchants)
      .values({
        name: val.data.name,
        slug: val.data.slug ?? slugify(val.data.name),
        website: val.data.website,
        logoUrl: val.data.logoUrl ?? null,
        verificationStatus: val.data.verificationStatus,
        status: val.data.status,
      })
      .returning();

    await recordAuditLog(admin.id, "MERCHANT_CREATE", "merchants", created!.id);

    return c.json(
      { data: created, meta: { timestamp: new Date().toISOString() } },
      201,
    );
  });

  app.get("/api/v1/admin/data-sources", async (c) => {
    const sources = await db
      .select()
      .from(dataSources)
      .orderBy(desc(dataSources.createdAt));

    return c.json({
      data: sources,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  app.post("/api/v1/admin/data-sources", async (c) => {
    const admin = c.get("user")!;
    const body = await c.req.json().catch(() => ({}));
    const val = validateOrError(c, createDataSourceSchema, body);
    if (!val.ok) return val.response;

    const [created] = await db
      .insert(dataSources)
      .values({
        name: val.data.name,
        sourceType: val.data.sourceType,
        configuration: val.data.configuration,
        status: val.data.status,
      })
      .returning();

    await recordAuditLog(
      admin.id,
      "DATA_SOURCE_CREATE",
      "data_sources",
      created!.id,
    );

    return c.json(
      { data: created, meta: { timestamp: new Date().toISOString() } },
      201,
    );
  });

  app.post("/api/v1/admin/offers/import", async (c) => {
    const admin = c.get("user")!;
    const body = await c.req.json().catch(() => ({}));
    const val = validateOrError(c, importOffersRequestSchema, body);
    if (!val.ok) return val.response;

    const payload =
      val.data.format === "csv" ? val.data.csvContent : val.data.records;

    const summary = await executeIngestionJob(db, {
      sourceId: val.data.sourceId,
      jobType: val.data.format === "csv" ? "csv_import" : "manual_sync",
      payload,
    });

    await recordAuditLog(
      admin.id,
      "OFFER_IMPORT",
      "ingestion_jobs",
      summary.jobId,
      {
        sourceId: val.data.sourceId,
        recordsProcessed: summary.recordsProcessed,
        recordsFailed: summary.recordsFailed,
      },
    );

    return c.json(
      { data: summary, meta: { timestamp: new Date().toISOString() } },
      201,
    );
  });

  app.get("/api/v1/admin/ingestion-jobs", async (c) => {
    const val = validateOrError(c, paginationQuerySchema, c.req.query());
    if (!val.ok) return val.response;

    const jobs = await db
      .select({
        id: ingestionJobs.id,
        sourceId: ingestionJobs.sourceId,
        sourceName: dataSources.name,
        sourceType: dataSources.sourceType,
        jobType: ingestionJobs.jobType,
        status: ingestionJobs.status,
        startedAt: ingestionJobs.startedAt,
        completedAt: ingestionJobs.completedAt,
        recordsProcessed: ingestionJobs.recordsProcessed,
        recordsFailed: ingestionJobs.recordsFailed,
        errorMessage: ingestionJobs.errorMessage,
        createdAt: ingestionJobs.createdAt,
      })
      .from(ingestionJobs)
      .innerJoin(dataSources, eq(ingestionJobs.sourceId, dataSources.id))
      .orderBy(desc(ingestionJobs.createdAt));

    return c.json({
      data: jobs,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  app.get("/api/v1/admin/match-candidates", async (c) => {
    const val = validateOrError(c, matchCandidateListQuerySchema, c.req.query());
    if (!val.ok) return val.response;

    const allCandidates = await db
      .select({
        id: productMatchCandidates.id,
        productId: productMatchCandidates.productId,
        sourceId: productMatchCandidates.sourceId,
        sourceName: dataSources.name,
        externalProductId: productMatchCandidates.externalProductId,
        candidateData: productMatchCandidates.candidateData,
        confidenceScore: productMatchCandidates.confidenceScore,
        matchingReasons: productMatchCandidates.matchingReasons,
        reviewStatus: productMatchCandidates.reviewStatus,
        createdAt: productMatchCandidates.createdAt,
        reviewedAt: productMatchCandidates.reviewedAt,
      })
      .from(productMatchCandidates)
      .innerJoin(
        dataSources,
        eq(productMatchCandidates.sourceId, dataSources.id),
      )
      .orderBy(desc(productMatchCandidates.createdAt));

    const filtered = val.data.reviewStatus
      ? allCandidates.filter((item) => item.reviewStatus === val.data.reviewStatus)
      : allCandidates;

    return c.json({
      data: filtered,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  app.post("/api/v1/admin/match-candidates/:id/approve", async (c) => {
    const admin = c.get("user")!;
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "รหัสรายการจับคู่ไม่ถูกต้อง",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        400,
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const val = validateOrError(c, approveMatchCandidateSchema, body);
    if (!val.ok) return val.response;

    const [candidate] = await db
      .select()
      .from(productMatchCandidates)
      .where(eq(productMatchCandidates.id, id))
      .limit(1);

    if (!candidate) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "ไม่พบรายการจับคู่สินค้า",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        404,
      );
    }

    const targetProductId = val.data.productId ?? candidate.productId;
    if (!targetProductId) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "กรุณาระบุ productId ที่ต้องการเชื่อมโยง",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        400,
      );
    }

    const now = new Date();
    const [updatedCandidate] = await db
      .update(productMatchCandidates)
      .set({
        productId: targetProductId,
        reviewStatus: "approved",
        reviewedAt: now,
      })
      .where(eq(productMatchCandidates.id, id))
      .returning();

    // If candidateData has full valid offer fields, also create/update the offer and snapshot
    const rawCandidate = candidate.candidateData ?? {};
    const vRes = validateSourceRecord({
      externalProductId: candidate.externalProductId,
      merchantWebsite: "https://www.advice.co.th",
      ...rawCandidate,
    });

    let createdOfferId: string | null = null;
    if (vRes.valid && vRes.record) {
      const normalized = normalizeSourceRecord(vRes.record);
      const offerUpsert = await upsertMerchantAndOffer(
        db,
        candidate.sourceId,
        targetProductId,
        normalized,
      );
      createdOfferId = offerUpsert.offerId;
      await recordPriceSnapshotIfNeeded(db, {
        offerId: offerUpsert.offerId,
        price: normalized.calculatedPrice.price,
        shippingCost: normalized.calculatedPrice.shippingCost,
        totalPrice: normalized.calculatedPrice.totalPrice,
        currency: normalized.calculatedPrice.currency,
        availabilityStatus: normalized.availabilityStatus,
      });
    }

    await recordAuditLog(
      admin.id,
      "MATCH_CANDIDATE_APPROVE",
      "product_match_candidates",
      id,
      { targetProductId, createdOfferId },
    );

    return c.json({
      data: {
        candidate: updatedCandidate,
        linkedProductId: targetProductId,
        offerId: createdOfferId,
      },
      meta: { timestamp: now.toISOString() },
    });
  });

  app.post("/api/v1/admin/match-candidates/:id/reject", async (c) => {
    const admin = c.get("user")!;
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "รหัสรายการจับคู่ไม่ถูกต้อง",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        400,
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const val = validateOrError(c, rejectMatchCandidateSchema, body);
    if (!val.ok) return val.response;

    const now = new Date();
    const [updated] = await db
      .update(productMatchCandidates)
      .set({
        reviewStatus: "rejected",
        reviewedAt: now,
      })
      .where(eq(productMatchCandidates.id, id))
      .returning();

    if (!updated) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "ไม่พบรายการจับคู่สินค้า",
            details: [],
            requestId: c.get("requestId"),
          },
        },
        404,
      );
    }

    await recordAuditLog(
      admin.id,
      "MATCH_CANDIDATE_REJECT",
      "product_match_candidates",
      id,
      { reason: val.data.reason ?? null },
    );

    return c.json({
      data: updated,
      meta: { timestamp: now.toISOString() },
    });
  });

  app.get("/api/v1/admin/reports/data-quality", async (c) => {
    const allProducts = await db.select().from(products);
    const allIdentifiers = await db.select().from(productIdentifiers);
    const allOffers = await db.select().from(offers);
    const pendingCandidates = await db
      .select()
      .from(productMatchCandidates)
      .where(eq(productMatchCandidates.reviewStatus, "pending"));

    const idsByProduct = new Set(allIdentifiers.map((i) => i.productId));
    const productsMissingIdentifiers = allProducts.filter(
      (p) => !idsByProduct.has(p.id),
    ).length;

    const staleCutoff = Date.now() - 48 * 60 * 60 * 1000;
    const staleOffersCount = allOffers.filter(
      (o) => new Date(o.lastCheckedAt).getTime() < staleCutoff,
    ).length;
    const offersWithUnknownShippingCount = allOffers.filter(
      (o) => o.shippingCost === null,
    ).length;

    return c.json({
      data: {
        totalProducts: allProducts.length,
        totalOffers: allOffers.length,
        productsMissingIdentifiers,
        staleOffersCount,
        offersWithUnknownShippingCount,
        pendingMatchCandidatesCount: pendingCandidates.length,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  });

  return { app, auth };
}
