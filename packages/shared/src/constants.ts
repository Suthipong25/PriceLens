export const DEFAULT_CURRENCY = "THB" as const;
export const SUPPORTED_CURRENCIES = ["THB"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const PRODUCT_STATUSES = ["active", "draft", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const IDENTIFIER_TYPES = ["GTIN", "EAN", "UPC", "BARCODE", "MPN", "SKU"] as const;
export type IdentifierType = (typeof IDENTIFIER_TYPES)[number];

export const GLOBAL_IDENTIFIER_TYPES = ["GTIN", "EAN", "UPC", "BARCODE"] as const;
export type GlobalIdentifierType = (typeof GLOBAL_IDENTIFIER_TYPES)[number];

export const MERCHANT_VERIFICATION_STATUSES = ["verified", "unverified", "unknown"] as const;
export type MerchantVerificationStatus = (typeof MERCHANT_VERIFICATION_STATUSES)[number];

export const MERCHANT_STATUSES = ["active", "inactive"] as const;
export type MerchantStatus = (typeof MERCHANT_STATUSES)[number];

export const DATA_SOURCE_TYPES = ["csv", "merchant_feed", "affiliate_api", "mock"] as const;
export type DataSourceType = (typeof DATA_SOURCE_TYPES)[number];

export const DATA_SOURCE_STATUSES = ["active", "paused", "disabled"] as const;
export type DataSourceStatus = (typeof DATA_SOURCE_STATUSES)[number];

export const AVAILABILITY_STATUSES = ["in_stock", "out_of_stock", "preorder", "unknown"] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const PRODUCT_CONDITIONS = ["new", "refurbished", "used", "unknown"] as const;
export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];

export const OFFER_STATUSES = ["active", "stale", "inactive"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const MATCH_REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type MatchReviewStatus = (typeof MATCH_REVIEW_STATUSES)[number];

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const NOTIFICATION_CHANNELS = ["email", "push"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = [
  "pending",
  "sent",
  "failed",
  "suppressed_duplicate",
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const INGESTION_JOB_TYPES = [
  "csv_import",
  "scheduled_sync",
  "manual_sync",
  "alert_evaluation",
] as const;
export type IngestionJobType = (typeof INGESTION_JOB_TYPES)[number];

export const INGESTION_JOB_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "partial",
] as const;
export type IngestionJobStatus = (typeof INGESTION_JOB_STATUSES)[number];

export const HISTORY_PERIODS = ["7d", "30d", "90d", "365d"] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

export const HISTORY_PERIOD_DAYS: Record<HistoryPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

export const PRODUCT_SORT_OPTIONS = [
  "price_asc",
  "total_price_asc",
  "price_desc",
  "popularity",
  "updated_desc",
] as const;
export type ProductSortOption = (typeof PRODUCT_SORT_OPTIONS)[number];

export const OFFER_SORT_OPTIONS = [
  "price_asc",
  "total_price_asc",
  "updated_desc",
  "merchant_asc",
] as const;
export type OfferSortOption = (typeof OFFER_SORT_OPTIONS)[number];

export const BUYING_SIGNALS = [
  "buy_now",
  "typical_price",
  "wait",
  "insufficient_data",
] as const;
export type BuyingSignal = (typeof BUYING_SIGNALS)[number];

export interface ProductAttributes {
  color?: string;
  size?: string;
  storage_capacity?: string;
  ram?: string;
  cpu?: string;
  gpu?: string;
  condition?: ProductCondition;
  variant?: string;
  is_demo?: boolean;
  [key: string]: string | number | boolean | undefined;
}
