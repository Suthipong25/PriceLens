import { sql } from "drizzle-orm";
import type { PriceLensDb } from "./client.js";

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" text NOT NULL,
    "email" text NOT NULL UNIQUE,
    "email_verified" boolean NOT NULL DEFAULT false,
    "image" text,
    "role" text NOT NULL DEFAULT 'user',
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "users_role_chk" CHECK ("role" IN ('user', 'admin'))
  )`,
  `CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email")`,

  `CREATE TABLE IF NOT EXISTS "sessions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "expires_at" timestamptz NOT NULL,
    "token" text NOT NULL UNIQUE,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "ip_address" text,
    "user_agent" text,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id")`,

  `CREATE TABLE IF NOT EXISTS "accounts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "account_id" text NOT NULL,
    "provider_id" text NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "access_token" text,
    "refresh_token" text,
    "id_token" text,
    "access_token_expires_at" timestamptz,
    "refresh_token_expires_at" timestamptz,
    "scope" text,
    "password" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts" ("user_id")`,

  `CREATE TABLE IF NOT EXISTS "verifications" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "identifier" text NOT NULL,
    "value" text NOT NULL,
    "expires_at" timestamptz NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "verifications_identifier_idx" ON "verifications" ("identifier")`,

  `CREATE TABLE IF NOT EXISTS "categories" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "parent_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
    "name" text NOT NULL,
    "slug" text NOT NULL UNIQUE,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "categories_parent_id_idx" ON "categories" ("parent_id")`,

  `CREATE TABLE IF NOT EXISTS "brands" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" text NOT NULL UNIQUE,
    "slug" text NOT NULL UNIQUE,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "brands_name_idx" ON "brands" ("name")`,

  `CREATE TABLE IF NOT EXISTS "products" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "category_id" uuid NOT NULL REFERENCES "categories"("id") ON DELETE RESTRICT,
    "brand_id" uuid NOT NULL REFERENCES "brands"("id") ON DELETE RESTRICT,
    "name" text NOT NULL,
    "slug" text NOT NULL UNIQUE,
    "model" text,
    "description" text,
    "image_url" text,
    "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "status" text NOT NULL DEFAULT 'active',
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "products_status_chk" CHECK ("status" IN ('active', 'draft', 'archived'))
  )`,
  `CREATE INDEX IF NOT EXISTS "products_category_status_idx" ON "products" ("category_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "products_brand_model_idx" ON "products" ("brand_id", "model")`,
  `CREATE INDEX IF NOT EXISTS "products_name_idx" ON "products" ("name")`,
  `CREATE INDEX IF NOT EXISTS "products_attributes_gin_idx" ON "products" USING GIN ("attributes")`,

  `CREATE TABLE IF NOT EXISTS "data_sources" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" text NOT NULL,
    "source_type" text NOT NULL,
    "configuration" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "status" text NOT NULL DEFAULT 'active',
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "data_sources_type_chk" CHECK ("source_type" IN ('csv', 'merchant_feed', 'affiliate_api', 'mock')),
    CONSTRAINT "data_sources_status_chk" CHECK ("status" IN ('active', 'paused', 'disabled'))
  )`,

  `CREATE TABLE IF NOT EXISTS "product_identifiers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "type" text NOT NULL,
    "value" text NOT NULL,
    "source_id" uuid REFERENCES "data_sources"("id") ON DELETE SET NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "product_identifiers_type_chk" CHECK ("type" IN ('GTIN', 'EAN', 'UPC', 'BARCODE', 'MPN', 'SKU')),
    CONSTRAINT "product_identifiers_type_value_source_uq" UNIQUE NULLS NOT DISTINCT ("type", "value", "source_id")
  )`,
  `CREATE INDEX IF NOT EXISTS "product_identifiers_lookup_idx" ON "product_identifiers" ("type", "value")`,
  `CREATE INDEX IF NOT EXISTS "product_identifiers_product_id_idx" ON "product_identifiers" ("product_id")`,

  `CREATE TABLE IF NOT EXISTS "merchants" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" text NOT NULL,
    "slug" text NOT NULL UNIQUE,
    "website" text NOT NULL,
    "logo_url" text,
    "verification_status" text NOT NULL DEFAULT 'unknown',
    "status" text NOT NULL DEFAULT 'active',
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "merchants_verification_chk" CHECK ("verification_status" IN ('verified', 'unverified', 'unknown')),
    CONSTRAINT "merchants_status_chk" CHECK ("status" IN ('active', 'inactive'))
  )`,

  `CREATE TABLE IF NOT EXISTS "offers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
    "merchant_id" uuid NOT NULL REFERENCES "merchants"("id") ON DELETE RESTRICT,
    "source_id" uuid NOT NULL REFERENCES "data_sources"("id") ON DELETE RESTRICT,
    "external_product_id" text NOT NULL,
    "title" text NOT NULL,
    "product_url" text NOT NULL,
    "affiliate_url" text,
    "price" numeric(12, 2) NOT NULL,
    "currency" varchar(3) NOT NULL DEFAULT 'THB',
    "shipping_cost" numeric(12, 2),
    "total_price" numeric(12, 2),
    "availability_status" text NOT NULL DEFAULT 'unknown',
    "condition" text NOT NULL DEFAULT 'new',
    "source_updated_at" timestamptz,
    "last_checked_at" timestamptz NOT NULL DEFAULT now(),
    "status" text NOT NULL DEFAULT 'active',
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "offers_source_external_uq" UNIQUE ("source_id", "external_product_id"),
    CONSTRAINT "offers_price_positive_chk" CHECK ("price" >= 0),
    CONSTRAINT "offers_shipping_positive_chk" CHECK ("shipping_cost" IS NULL OR "shipping_cost" >= 0),
    CONSTRAINT "offers_total_price_integrity_chk" CHECK (
      ("shipping_cost" IS NULL AND "total_price" IS NULL)
      OR ("shipping_cost" IS NOT NULL AND "total_price" = "price" + "shipping_cost")
    ),
    CONSTRAINT "offers_availability_chk" CHECK ("availability_status" IN ('in_stock', 'out_of_stock', 'preorder', 'unknown')),
    CONSTRAINT "offers_condition_chk" CHECK ("condition" IN ('new', 'refurbished', 'used', 'unknown')),
    CONSTRAINT "offers_status_chk" CHECK ("status" IN ('active', 'stale', 'inactive'))
  )`,
  `CREATE INDEX IF NOT EXISTS "offers_product_status_price_idx" ON "offers" ("product_id", "status", "price")`,
  `CREATE INDEX IF NOT EXISTS "offers_product_total_price_idx" ON "offers" ("product_id", "status", "total_price")`,
  `CREATE INDEX IF NOT EXISTS "offers_merchant_id_idx" ON "offers" ("merchant_id")`,

  `CREATE TABLE IF NOT EXISTS "price_snapshots" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "offer_id" uuid NOT NULL REFERENCES "offers"("id") ON DELETE RESTRICT,
    "price" numeric(12, 2) NOT NULL,
    "shipping_cost" numeric(12, 2),
    "total_price" numeric(12, 2),
    "currency" varchar(3) NOT NULL DEFAULT 'THB',
    "availability_status" text NOT NULL DEFAULT 'unknown',
    "recorded_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "snapshots_price_positive_chk" CHECK ("price" >= 0),
    CONSTRAINT "snapshots_shipping_positive_chk" CHECK ("shipping_cost" IS NULL OR "shipping_cost" >= 0),
    CONSTRAINT "snapshots_total_price_integrity_chk" CHECK (
      ("shipping_cost" IS NULL AND "total_price" IS NULL)
      OR ("shipping_cost" IS NOT NULL AND "total_price" = "price" + "shipping_cost")
    )
  )`,
  `CREATE INDEX IF NOT EXISTS "price_snapshots_offer_recorded_idx" ON "price_snapshots" ("offer_id", "recorded_at" DESC)`,

  `CREATE TABLE IF NOT EXISTS "product_match_candidates" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
    "source_id" uuid NOT NULL REFERENCES "data_sources"("id") ON DELETE CASCADE,
    "external_product_id" text NOT NULL,
    "candidate_data" jsonb NOT NULL,
    "confidence_score" numeric(5, 2) NOT NULL,
    "matching_reasons" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "review_status" text NOT NULL DEFAULT 'pending',
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "reviewed_at" timestamptz,
    CONSTRAINT "match_candidates_confidence_chk" CHECK ("confidence_score" >= 0 AND "confidence_score" <= 100),
    CONSTRAINT "match_candidates_review_status_chk" CHECK ("review_status" IN ('pending', 'approved', 'rejected')),
    CONSTRAINT "match_candidates_source_ext_product_uq" UNIQUE NULLS NOT DISTINCT ("source_id", "external_product_id", "product_id")
  )`,
  `CREATE INDEX IF NOT EXISTS "match_candidates_review_status_idx" ON "product_match_candidates" ("review_status", "confidence_score" DESC)`,

  `CREATE TABLE IF NOT EXISTS "ingestion_jobs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "source_id" uuid NOT NULL REFERENCES "data_sources"("id") ON DELETE RESTRICT,
    "job_type" text NOT NULL,
    "status" text NOT NULL DEFAULT 'queued',
    "started_at" timestamptz,
    "completed_at" timestamptz,
    "records_processed" integer NOT NULL DEFAULT 0,
    "records_failed" integer NOT NULL DEFAULT 0,
    "error_message" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "ingestion_jobs_type_chk" CHECK ("job_type" IN ('csv_import', 'scheduled_sync', 'manual_sync', 'alert_evaluation')),
    CONSTRAINT "ingestion_jobs_status_chk" CHECK ("status" IN ('queued', 'running', 'completed', 'failed', 'partial')),
    CONSTRAINT "ingestion_jobs_processed_chk" CHECK ("records_processed" >= 0),
    CONSTRAINT "ingestion_jobs_failed_chk" CHECK ("records_failed" >= 0)
  )`,
  `CREATE INDEX IF NOT EXISTS "ingestion_jobs_source_created_idx" ON "ingestion_jobs" ("source_id", "created_at" DESC)`,
  `CREATE INDEX IF NOT EXISTS "ingestion_jobs_status_idx" ON "ingestion_jobs" ("status")`,

  `CREATE TABLE IF NOT EXISTS "watchlists" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "watchlists_user_product_uq" UNIQUE ("user_id", "product_id")
  )`,
  `CREATE INDEX IF NOT EXISTS "watchlists_user_id_idx" ON "watchlists" ("user_id")`,

  `CREATE TABLE IF NOT EXISTS "price_alerts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "target_price" numeric(12, 2) NOT NULL,
    "currency" varchar(3) NOT NULL DEFAULT 'THB',
    "is_active" boolean NOT NULL DEFAULT true,
    "last_notified_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "price_alerts_target_positive_chk" CHECK ("target_price" > 0),
    CONSTRAINT "price_alerts_user_product_uq" UNIQUE ("user_id", "product_id")
  )`,
  `CREATE INDEX IF NOT EXISTS "price_alerts_active_product_idx" ON "price_alerts" ("product_id", "is_active", "target_price")`,

  `CREATE TABLE IF NOT EXISTS "notifications" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "alert_id" uuid NOT NULL REFERENCES "price_alerts"("id") ON DELETE CASCADE,
    "channel" text NOT NULL DEFAULT 'email',
    "status" text NOT NULL,
    "message" text NOT NULL,
    "sent_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "notifications_channel_chk" CHECK ("channel" IN ('email', 'push')),
    CONSTRAINT "notifications_status_chk" CHECK ("status" IN ('pending', 'sent', 'failed', 'suppressed_duplicate'))
  )`,
  `CREATE INDEX IF NOT EXISTS "notifications_user_created_idx" ON "notifications" ("user_id", "created_at" DESC)`,
  `CREATE INDEX IF NOT EXISTS "notifications_alert_id_idx" ON "notifications" ("alert_id")`,

  `CREATE TABLE IF NOT EXISTS "affiliate_clicks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
    "offer_id" uuid NOT NULL REFERENCES "offers"("id") ON DELETE RESTRICT,
    "affiliate_source" text NOT NULL,
    "tracking_id" text NOT NULL UNIQUE,
    "clicked_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "affiliate_clicks_offer_clicked_idx" ON "affiliate_clicks" ("offer_id", "clicked_at" DESC)`,
  `CREATE INDEX IF NOT EXISTS "affiliate_clicks_user_id_idx" ON "affiliate_clicks" ("user_id")`,

  `CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "actor_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
    "action" text NOT NULL,
    "entity_type" text NOT NULL,
    "entity_id" text NOT NULL,
    "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "audit_logs_actor_created_idx" ON "audit_logs" ("actor_id", "created_at" DESC)`,
];

export async function migrateDatabase(db: PriceLensDb): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
}
