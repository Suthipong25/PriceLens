import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type {
  AvailabilityStatus,
  DataSourceStatus,
  DataSourceType,
  IdentifierType,
  IngestionJobStatus,
  IngestionJobType,
  MatchReviewStatus,
  MerchantStatus,
  MerchantVerificationStatus,
  NotificationChannel,
  NotificationStatus,
  OfferStatus,
  ProductAttributes,
  ProductCondition,
  ProductStatus,
  UserRole,
} from "@pricelens/shared";

// ============================================================================
// 1. Better Auth Core Tables (UUID Primary Keys)
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: text("role").$type<UserRole>().default("user").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("users_role_chk", sql`${table.role} IN ('user', 'admin')`),
    index("users_email_idx").on(table.email),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

// ============================================================================
// 2. Catalog Tables (Categories, Brands, Products, Identifiers)
// ============================================================================

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("categories_parent_id_idx").on(table.parentId)],
);

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(),
    slug: text("slug").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("brands_name_idx").on(table.name)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    model: text("model"),
    description: text("description"),
    imageUrl: text("image_url"),
    attributes: jsonb("attributes")
      .$type<ProductAttributes>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    status: text("status").$type<ProductStatus>().default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("products_status_chk", sql`${table.status} IN ('active', 'draft', 'archived')`),
    index("products_category_status_idx").on(table.categoryId, table.status),
    index("products_brand_model_idx").on(table.brandId, table.model),
    index("products_name_idx").on(table.name),
  ],
);

export const dataSources = pgTable(
  "data_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    sourceType: text("source_type").$type<DataSourceType>().notNull(),
    configuration: jsonb("configuration")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    status: text("status").$type<DataSourceStatus>().default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "data_sources_type_chk",
      sql`${table.sourceType} IN ('csv', 'merchant_feed', 'affiliate_api', 'mock')`,
    ),
    check(
      "data_sources_status_chk",
      sql`${table.status} IN ('active', 'paused', 'disabled')`,
    ),
  ],
);

export const productIdentifiers = pgTable(
  "product_identifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    type: text("type").$type<IdentifierType>().notNull(),
    value: text("value").notNull(),
    sourceId: uuid("source_id").references(() => dataSources.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "product_identifiers_type_chk",
      sql`${table.type} IN ('GTIN', 'EAN', 'UPC', 'BARCODE', 'MPN', 'SKU')`,
    ),
    unique("product_identifiers_type_value_source_uq")
      .on(table.type, table.value, table.sourceId)
      .nullsNotDistinct(),
    index("product_identifiers_lookup_idx").on(table.type, table.value),
    index("product_identifiers_product_id_idx").on(table.productId),
  ],
);

// ============================================================================
// 3. Merchants, Offers, Price Snapshots, Match Candidates, Ingestion Jobs
// ============================================================================

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    website: text("website").notNull(),
    logoUrl: text("logo_url"),
    verificationStatus: text("verification_status")
      .$type<MerchantVerificationStatus>()
      .default("unknown")
      .notNull(),
    status: text("status").$type<MerchantStatus>().default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "merchants_verification_chk",
      sql`${table.verificationStatus} IN ('verified', 'unverified', 'unknown')`,
    ),
    check("merchants_status_chk", sql`${table.status} IN ('active', 'inactive')`),
  ],
);

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "restrict" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "restrict" }),
    externalProductId: text("external_product_id").notNull(),
    title: text("title").notNull(),
    productUrl: text("product_url").notNull(),
    affiliateUrl: text("affiliate_url"),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("THB").notNull(),
    shippingCost: numeric("shipping_cost", { precision: 12, scale: 2 }),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 }),
    availabilityStatus: text("availability_status")
      .$type<AvailabilityStatus>()
      .default("unknown")
      .notNull(),
    condition: text("condition").$type<ProductCondition>().default("new").notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    status: text("status").$type<OfferStatus>().default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("offers_source_external_uq").on(table.sourceId, table.externalProductId),
    check("offers_price_positive_chk", sql`${table.price} >= 0`),
    check(
      "offers_shipping_positive_chk",
      sql`${table.shippingCost} IS NULL OR ${table.shippingCost} >= 0`,
    ),
    check(
      "offers_total_price_integrity_chk",
      sql`(${table.shippingCost} IS NULL AND ${table.totalPrice} IS NULL) OR (${table.shippingCost} IS NOT NULL AND ${table.totalPrice} = ${table.price} + ${table.shippingCost})`,
    ),
    check(
      "offers_availability_chk",
      sql`${table.availabilityStatus} IN ('in_stock', 'out_of_stock', 'preorder', 'unknown')`,
    ),
    check(
      "offers_condition_chk",
      sql`${table.condition} IN ('new', 'refurbished', 'used', 'unknown')`,
    ),
    check("offers_status_chk", sql`${table.status} IN ('active', 'stale', 'inactive')`),
    index("offers_product_status_price_idx").on(table.productId, table.status, table.price),
    index("offers_product_total_price_idx").on(
      table.productId,
      table.status,
      table.totalPrice,
    ),
    index("offers_merchant_id_idx").on(table.merchantId),
  ],
);

export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "restrict" }),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    shippingCost: numeric("shipping_cost", { precision: 12, scale: 2 }),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 3 }).default("THB").notNull(),
    availabilityStatus: text("availability_status")
      .$type<AvailabilityStatus>()
      .default("unknown")
      .notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("snapshots_price_positive_chk", sql`${table.price} >= 0`),
    check(
      "snapshots_shipping_positive_chk",
      sql`${table.shippingCost} IS NULL OR ${table.shippingCost} >= 0`,
    ),
    check(
      "snapshots_total_price_integrity_chk",
      sql`(${table.shippingCost} IS NULL AND ${table.totalPrice} IS NULL) OR (${table.shippingCost} IS NOT NULL AND ${table.totalPrice} = ${table.price} + ${table.shippingCost})`,
    ),
    index("price_snapshots_offer_recorded_idx").on(table.offerId, table.recordedAt),
  ],
);

export const productMatchCandidates = pgTable(
  "product_match_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "cascade" }),
    externalProductId: text("external_product_id").notNull(),
    candidateData: jsonb("candidate_data")
      .$type<Record<string, unknown>>()
      .notNull(),
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }).notNull(),
    matchingReasons: jsonb("matching_reasons")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    reviewStatus: text("review_status")
      .$type<MatchReviewStatus>()
      .default("pending")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "match_candidates_confidence_chk",
      sql`${table.confidenceScore} >= 0 AND ${table.confidenceScore} <= 100`,
    ),
    check(
      "match_candidates_review_status_chk",
      sql`${table.reviewStatus} IN ('pending', 'approved', 'rejected')`,
    ),
    unique("match_candidates_source_ext_product_uq")
      .on(table.sourceId, table.externalProductId, table.productId)
      .nullsNotDistinct(),
    index("match_candidates_review_status_idx").on(
      table.reviewStatus,
      table.confidenceScore,
    ),
  ],
);

export const ingestionJobs = pgTable(
  "ingestion_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "restrict" }),
    jobType: text("job_type").$type<IngestionJobType>().notNull(),
    status: text("status").$type<IngestionJobStatus>().default("queued").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    recordsProcessed: integer("records_processed").default(0).notNull(),
    recordsFailed: integer("records_failed").default(0).notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "ingestion_jobs_type_chk",
      sql`${table.jobType} IN ('csv_import', 'scheduled_sync', 'manual_sync', 'alert_evaluation')`,
    ),
    check(
      "ingestion_jobs_status_chk",
      sql`${table.status} IN ('queued', 'running', 'completed', 'failed', 'partial')`,
    ),
    check("ingestion_jobs_processed_chk", sql`${table.recordsProcessed} >= 0`),
    check("ingestion_jobs_failed_chk", sql`${table.recordsFailed} >= 0`),
    index("ingestion_jobs_source_created_idx").on(table.sourceId, table.createdAt),
    index("ingestion_jobs_status_idx").on(table.status),
  ],
);

// ============================================================================
// 4. User Engagement, Affiliate & Audit Tables
// ============================================================================

export const watchlists = pgTable(
  "watchlists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("watchlists_user_product_uq").on(table.userId, table.productId),
    index("watchlists_user_id_idx").on(table.userId),
  ],
);

export const priceAlerts = pgTable(
  "price_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    targetPrice: numeric("target_price", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("THB").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("price_alerts_target_positive_chk", sql`${table.targetPrice} > 0`),
    unique("price_alerts_user_product_uq").on(table.userId, table.productId),
    index("price_alerts_active_product_idx").on(
      table.productId,
      table.isActive,
      table.targetPrice,
    ),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    alertId: uuid("alert_id")
      .notNull()
      .references(() => priceAlerts.id, { onDelete: "cascade" }),
    channel: text("channel").$type<NotificationChannel>().default("email").notNull(),
    status: text("status").$type<NotificationStatus>().notNull(),
    message: text("message").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("notifications_channel_chk", sql`${table.channel} IN ('email', 'push')`),
    check(
      "notifications_status_chk",
      sql`${table.status} IN ('pending', 'sent', 'failed', 'suppressed_duplicate')`,
    ),
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
    index("notifications_alert_id_idx").on(table.alertId),
  ],
);

export const affiliateClicks = pgTable(
  "affiliate_clicks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "restrict" }),
    affiliateSource: text("affiliate_source").notNull(),
    trackingId: text("tracking_id").notNull().unique(),
    clickedAt: timestamp("clicked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("affiliate_clicks_offer_clicked_idx").on(table.offerId, table.clickedAt),
    index("affiliate_clicks_user_id_idx").on(table.userId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("audit_logs_actor_created_idx").on(table.actorId, table.createdAt)],
);

// ============================================================================
// 5. Drizzle ORM Relations
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  watchlists: many(watchlists),
  priceAlerts: many(priceAlerts),
  notifications: many(notifications),
  affiliateClicks: many(affiliateClicks),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "category_hierarchy",
  }),
  children: many(categories, { relationName: "category_hierarchy" }),
  products: many(products),
}));

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  identifiers: many(productIdentifiers),
  offers: many(offers),
  matchCandidates: many(productMatchCandidates),
  watchlists: many(watchlists),
  priceAlerts: many(priceAlerts),
}));

export const productIdentifiersRelations = relations(productIdentifiers, ({ one }) => ({
  product: one(products, {
    fields: [productIdentifiers.productId],
    references: [products.id],
  }),
  source: one(dataSources, {
    fields: [productIdentifiers.sourceId],
    references: [dataSources.id],
  }),
}));

export const merchantsRelations = relations(merchants, ({ many }) => ({
  offers: many(offers),
}));

export const dataSourcesRelations = relations(dataSources, ({ many }) => ({
  offers: many(offers),
  identifiers: many(productIdentifiers),
  matchCandidates: many(productMatchCandidates),
  ingestionJobs: many(ingestionJobs),
}));

export const offersRelations = relations(offers, ({ one, many }) => ({
  product: one(products, { fields: [offers.productId], references: [products.id] }),
  merchant: one(merchants, { fields: [offers.merchantId], references: [merchants.id] }),
  source: one(dataSources, { fields: [offers.sourceId], references: [dataSources.id] }),
  snapshots: many(priceSnapshots),
  affiliateClicks: many(affiliateClicks),
}));

export const priceSnapshotsRelations = relations(priceSnapshots, ({ one }) => ({
  offer: one(offers, { fields: [priceSnapshots.offerId], references: [offers.id] }),
}));

export const productMatchCandidatesRelations = relations(
  productMatchCandidates,
  ({ one }) => ({
    product: one(products, {
      fields: [productMatchCandidates.productId],
      references: [products.id],
    }),
    source: one(dataSources, {
      fields: [productMatchCandidates.sourceId],
      references: [dataSources.id],
    }),
  }),
);

export const watchlistsRelations = relations(watchlists, ({ one }) => ({
  user: one(users, { fields: [watchlists.userId], references: [users.id] }),
  product: one(products, { fields: [watchlists.productId], references: [products.id] }),
}));

export const priceAlertsRelations = relations(priceAlerts, ({ one, many }) => ({
  user: one(users, { fields: [priceAlerts.userId], references: [users.id] }),
  product: one(products, { fields: [priceAlerts.productId], references: [products.id] }),
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  alert: one(priceAlerts, { fields: [notifications.alertId], references: [priceAlerts.id] }),
}));

export const affiliateClicksRelations = relations(affiliateClicks, ({ one }) => ({
  user: one(users, { fields: [affiliateClicks.userId], references: [users.id] }),
  offer: one(offers, { fields: [affiliateClicks.offerId], references: [offers.id] }),
}));

export const ingestionJobsRelations = relations(ingestionJobs, ({ one }) => ({
  source: one(dataSources, {
    fields: [ingestionJobs.sourceId],
    references: [dataSources.id],
  }),
}));
