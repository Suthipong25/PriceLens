# PriceLens — Product Requirements Document (PRD)

**Product Name:** PriceLens  
**Tagline:** Shop smarter. Pay less.  
**Target Market:** Thailand (`THB`, `th-TH` / `en-TH`)  
**Platforms:** Web Application (Next.js) & Mobile Application (Expo / React Native)  
**Document Status:** Draft v1.0 — Pending Architecture Approval

---

## 1. Executive Summary & Vision

PriceLens is a commercial smart shopping intelligence and price comparison platform built for the Thai e-commerce ecosystem. Consumers in Thailand face fragmented pricing across multi-category marketplaces, specialty IT/electronics retailers, and official brand stores—often obscured by inconsistent product titles, bundled variants, unverified shipping fees, and artificial "flash sale" discounts.

PriceLens solves this through **deterministic product matching**, **total-cost transparency**, and **verifiable historical price tracking**.

### The Six Core Questions PriceLens Answers
1. **Where can I buy this product at the lowest price?** — Aggregates offers for the exact same product across verified merchants.
2. **Is this the exact same product model?** — Uses a strict deterministic matching engine (GTIN/EAN, MPN, Brand + Model + Variant attributes) and never merges distinct capacities, colors, sizes, or product conditions.
3. **What is the total price, including shipping when known?** — Explicitly separates base `price`, `shipping_cost`, and `total_price`. Unknown shipping costs are labeled `Unknown` rather than assumed to be zero.
4. **Has this product been cheaper before?** — Records append-only price snapshots to display 7-day, 30-day, 90-day, and 365-day historical price charts alongside historical minimum and maximum prices.
5. **Should I buy now or wait?** — Computes a transparent buying signal strictly from recorded historical price percentiles (never fabricated).
6. **Can I receive an alert when the price drops?** — Lets users save products to a watchlist and configure target price alerts with deduplicated email notifications (and mobile push notifications in Phase 5).

---

## 2. Market Strategy & Launch Scope

### 2.1 Category Strategy
- **Architecture Scope:** Category-agnostic relational catalog (`categories` hierarchy + JSONB `attributes` on `products`) capable of supporting electronics, home appliances, health & beauty, fashion, and FMCG.
- **Launch Scope (Phase 1–3 MVP):** Focus on **Consumer Electronics, Smartphones, Laptops, Monitors, Audio, and PC Components** in Thailand.
  - *Rationale:* High average order value (AOV), standardized global identifiers (EAN-13, UPC, MPN), high consumer sensitivity to price variations, and structured merchant data feeds from Thai IT retailers (e.g., Advice, JIB, Banana IT, Power Buy) and regional affiliate networks (Involve Asia, Accesstrade Thailand).

### 2.2 Data Integrity & Trust Mandate
PriceLens competes on user trust. The platform enforces strict non-negotiable data rules:
- **Zero Fabrication:** Never invent shipping costs, stock availability, merchant ratings, user reviews, or backfilled price history.
- **Null vs. Zero Distinction:** A shipping cost of `0.00 THB` means **Verified Free Shipping**. A shipping cost of `null` means **Shipping Unknown**, which disqualifies the offer from being ranked as "Lowest Verified Total Price."
- **Authorized Data Sources Only:** PriceLens ingests data solely via authorized CSV imports, partner merchant feeds, and compliant affiliate APIs. It never scrapes unauthorized pages or bypasses anti-bot/access controls.
- **Explicit Demo Labeling:** In local development and staging environments, seeded catalog records must display a visible `[DEMO DATA]` indicator.

---

## 3. User Personas & Access Roles

| Role | Description | Key Capabilities |
| :--- | :--- | :--- |
| **Visitor (Public)** | Unauthenticated shopper arriving via search engine or direct link | Search products, browse categories/brands, compare merchant offers, inspect price history charts, click outbound merchant/affiliate links. |
| **Member (`user`)** | Authenticated shopper with a registered account | All Visitor capabilities + manage Watchlist, create/toggle Target Price Alerts, view notification history, delete account (PDPA compliance). |
| **Administrator (`admin`)** | Internal catalog manager / operations engineer | All Member capabilities + manage products/categories/brands/merchants/data sources, upload CSV feeds, review & approve/reject uncertain product match candidates, monitor ingestion jobs, view data quality reports & audit logs. |

---

## 4. Functional Requirements by Module

### Module A: Product Discovery
- **Multi-Identifier & Text Search:** Search canonical products by product name, brand name, model code, SKU, EAN, GTIN, or MPN.
- **Faceted Filtering:** Filter results by category (including subcategories), brand, merchant availability, and base price range (`minPrice`, `maxPrice`).
- **Sorting:**
  - Lowest Product Price (`price_asc`)
  - Lowest Verified Total Price (`total_price_asc` — offers with known shipping prioritized)
  - Highest Price (`price_desc`)
  - Popularity (`popularity` — based on recorded outbound click volume)
  - Recently Checked (`updated_desc`)
- **Suggestions & SEO:** Display related products in the same category/brand and render crawlable server-side metadata with structured JSON-LD (`Product` and `AggregateOffer`) markup on product pages.

### Module B: Product Comparison
- **Merchant Comparison Table:** Display all active offers mapped to a canonical product.
- **Per-Offer Data Points:**
  - Merchant name, logo, and verification badge (`verified`, `unverified`, or `unknown` based on source metadata).
  - Base product price (`THB`).
  - Shipping cost (`Free (฿0.00)`, exact `฿XX.XX`, or `Shipping unknown`).
  - Total price (`price + shipping_cost` when shipping is known; `฿XX,XXX + shipping` when shipping is `null`).
  - Product condition (`new`, `refurbished`, `used`, `unknown`).
  - Stock status (`in_stock`, `out_of_stock`, `preorder`, `unknown`).
  - Freshness indicator (`last_checked_at` relative & absolute timestamp).
  - Outbound CTA button routed through the affiliate click tracking endpoint.

### Module C: Product Matching Engine
- **Matching Hierarchy:**
  1. **GTIN / EAN / UPC / Barcode** (Exact match + attribute sanity check → Confidence `100%`).
  2. **Manufacturer Part Number (MPN)** (Exact normalized MPN + Brand match → Confidence `95%`).
  3. **Brand + Model + Variant Attributes** (Exact brand, model identifier, and matching variant attributes → Confidence `90%`).
  4. **Normalized Product Title + Attribute Comparison** (Candidate generation only → Confidence `50%–84%`, routed to Admin Review Queue).
- **Variant Isolation Rules:**
  - Products with different `storage_capacity` (e.g., 256GB vs. 512GB), `ram` (8GB vs. 16GB), `color`, `size`, `cpu`, `gpu`, or `condition` must **never** be merged into the same canonical product.
- **Human-in-the-Loop Review Queue:**
  - Uncertain matches (`confidence < 90%` or missing hard identifiers) are saved in `product_match_candidates` with `review_status = 'pending'`, structured `matching_reasons`, and side-by-side attribute diffs for Admin approval or rejection.

### Module D: Price History & Buying Intelligence
- **Snapshot Storage:** Every offer price/shipping/availability change (or daily verification point) is appended to `price_snapshots`.
- **Time Horizon Selector:** Support `7d`, `30d`, `90d`, and `365d` views.
- **Key Metrics:** Current lowest price, Historical Minimum price (with date), Historical Maximum price (with date), and Last Updated timestamp.
- **Buy Now vs. Wait Signal:**
  - **Good Time to Buy:** Current price is at or within 3% of the historical minimum (requires $\ge 7$ days of snapshot data).
  - **Typical Price:** Current price is within normal historical range.
  - **Wait if Possible:** Current price is $> 10\%$ above the 30-day average.
  - **Insufficient History:** Fewer than 2 distinct daily snapshots exist — explicitly shows an honest empty state ("Tracking started recently — not enough historical data to recommend buying timing yet").

### Module E: Watchlist & Price Alerts
- **Watchlist:** One-click bookmarking of canonical products for signed-in users.
- **Price Alerts:**
  - Users specify a `target_price` (`THB`) for a canonical product.
  - Users can pause/resume (`is_active`) or delete alerts at any time.
- **Notification Delivery & Deduplication:**
  - Evaluated automatically after offer ingestion/updates.
  - Triggers when an active in-stock offer has `price <= target_price`.
  - Prevents duplicate spam: Once notified, an alert will not trigger again for the same or higher price within a cooldown window (`last_notified_at` check), and every attempt is recorded in `notifications` (`sent`, `failed`, `suppressed_duplicate`).

### Module F: Affiliate Tracking
- **Click Logging:** Outbound merchant links pass through `/api/v1/offers/:id/click`, recording `offer_id`, optional `user_id`, `affiliate_source`, unique `tracking_id`, and `clicked_at`.
- **Compliant Redirection:** Redirects to `affiliate_url` when configured, falling back to `product_url`.
- **Conversion Honesty:** Outbound clicks are tracked solely as clicks (`affiliate_clicks`), never reported as completed purchases unless verified conversion callbacks are integrated.

### Module G: Admin Dashboard
- **Catalog Management:** Create and edit Categories, Brands, Canonical Products, and Product Identifiers.
- **Merchant & Source Management:** Configure Merchants and Data Sources (CSV, Merchant Feed, Affiliate API) without storing plaintext secrets in database fields.
- **Offer & CSV Import Management:** Upload CSV files or trigger feed sync jobs; inspect row-level validation errors.
- **Matching Review Queue:** Inspect `pending` candidates, view confidence scores and matching reasons, and approve (link to existing product or create new canonical product) or reject.
- **Operations & Data Quality:** Monitor `ingestion_jobs` status/error logs, view stale offers report, and inspect admin audit logs.

---

## 5. User Interface & Experience Requirements

### 5.1 Visual System
- **Aesthetic Direction:** Clean, high-trust financial/shopping intelligence interface with clear typographic hierarchy and zero visual clutter.
- **Color Palette (Semantic Tokens):**
  - Primary Brand: `#1D4ED8` (`blue-700`) / `#2563EB` (`blue-600`)
  - Secondary / Surface Contrast: `#0F172A` (`slate-900` Navy)
  - Backgrounds: `#FFFFFF` (Primary surface), `#F8FAFC` (`slate-50` Secondary background)
  - Semantic Status: `#15803D` (Success / Best Price / In Stock), `#B45309` (Warning / Unknown Shipping / Stale), `#B91C1C` (Error / Out of Stock / Above Average)
- **Typography & Numbers:** All prices, percentages, and timestamps must use `font-variant-numeric: tabular-nums` so comparison columns align vertically to the pixel.

### 5.2 Required Web Screens (18 Views)
1. **Homepage** (`/`) — Search hero, featured categories, recently price-dropped products, trust & methodology explainer.
2. **Search Results** (`/search`) — Query results, facet sidebar (category, brand, merchant, price range), sort selector.
3. **Category Page** (`/categories/[slug]`) — Category hierarchy breadcrumb, filtered product grid.
4. **Brand Page** (`/brands/[slug]`) — Brand overview and product catalog.
5. **Product Detail Page** (`/products/[slug]`) — Canonical product header, specs, identifier badges, Buy/Wait signal, embedded comparison & history sections.
6. **Price Comparison Section** (Embedded on Product Detail) — Sortable multi-merchant offer table with shipping & total price breakdown.
7. **Price History Section** (Embedded on Product Detail) — 7d/30d/90d/365d chart, min/max cards, and empty-state handling.
8. **Login** (`/login`) — Better Auth email/password sign-in with Turnstile protection.
9. **Register** (`/register`) — Account registration with validation and Turnstile protection.
10. **User Dashboard** (`/dashboard`) — Overview of saved watchlist items, triggered alerts, and account settings (including account deletion).
11. **Watchlist** (`/dashboard/watchlist`) — Saved products with current lowest price vs. price when saved.
12. **Price Alerts** (`/dashboard/alerts`) — Active/paused target price alerts and notification delivery log.
13. **Admin Dashboard** (`/admin`) — KPI summary (active products, active offers, pending match candidates, recent ingestion jobs, data quality warnings).
14. **Product Management** (`/admin/products`) — Admin CRUD for products, categories, brands, and identifiers.
15. **Merchant Management** (`/admin/merchants`) — Admin CRUD for merchants and verification status.
16. **Data Source Management** (`/admin/data-sources`) — Configure feed adapters and upload CSV offer imports.
17. **Matching Review Queue** (`/admin/match-candidates`) — Side-by-side candidate comparison with Approve / Reject actions.
18. **Ingestion Job Monitor** (`/admin/ingestion-jobs`) — Job execution history, processed/failed counts, error logs, and Data Quality report view.

---

## 6. Success Metrics

- **Matching Precision:** $100\%$ precision on auto-matched offers (zero false-positive merges across incompatible product variants).
- **Price & Shipping Accuracy:** $100\%$ adherence to total price calculation rules (`total_price` only populated when shipping is verified).
- **Ingestion Idempotency:** Re-running the same CSV or feed payload produces zero duplicate products, zero duplicate active offers, and zero duplicate price alert emails.
- **Web Core Vitals & Accessibility:** WCAG 2.2 AA contrast and keyboard navigation compliance across all 18 screens; responsive down to `320px` width and `200%` zoom.
