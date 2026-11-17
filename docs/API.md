# PriceLens — REST API Specification (`API.md`)

**Base Path:** `/api/v1`  
**OpenAPI Specification Endpoint:** `GET /api/v1/openapi.json`  
**Content-Type:** `application/json; charset=utf-8`  
**Authentication:** Better Auth session cookie (`pricelens.session_token`) for Web; `Authorization: Bearer <session_token>` for Mobile.

---

## 1. Standard Response & Error Envelopes

### 1.1 Success Envelope (Single Resource)
```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2026-11-16T08:45:00.000Z"
  }
}
```

### 1.2 Success Envelope (Paginated Collection)
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 142,
    "totalPages": 8,
    "hasNextPage": true
  },
  "meta": {
    "timestamp": "2026-11-16T08:45:00.000Z"
  }
}
```

### 1.3 Error Envelope
Internal stack traces, SQL errors, and secrets are never exposed to clients.
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      { "field": "minPrice", "issue": "Must be a non-negative number" }
    ],
    "requestId": "req_01JCTP9X8K2M"
  }
}
```

| HTTP Status | Error Code | Meaning |
| :--- | :--- | :--- |
| `400` | `VALIDATION_ERROR` / `BAD_REQUEST` | Request body, query, or parameters failed Zod validation |
| `401` | `UNAUTHORIZED` | Missing or expired authentication session |
| `403` | `FORBIDDEN` | Authenticated user lacks required role (`admin`) or failed Turnstile check |
| `404` | `NOT_FOUND` | Requested resource does not exist |
| `409` | `CONFLICT` | Duplicate identifier, watchlist item, or concurrent state conflict |
| `422` | `UNPROCESSABLE_ENTITY` | Semantically invalid operation (e.g., currency mismatch or invalid CSV schema) |
| `429` | `RATE_LIMITED` | Rate limit exceeded (`Retry-After` header returned) |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected server error (logged to Sentry with `requestId`) |

---

## 2. Public API Endpoints

### `GET /api/v1/products`
Search and filter canonical products with aggregated lowest offer pricing.

**Query Parameters (Zod Validated):**
- `q` (`string`, optional): Search query matched against product `name`, `brand.name`, `model`, or `product_identifiers.value` (`GTIN`, `EAN`, `UPC`, `MPN`, `SKU`).
- `categorySlug` (`string`, optional): Filter by category (includes direct subcategories).
- `brandSlug` (`string`, optional): Filter by brand.
- `merchantSlug` (`string`, optional): Filter to products carried by a specific merchant.
- `minPrice` (`number >= 0`, optional): Minimum current product price (`THB`).
- `maxPrice` (`number >= 0`, optional): Maximum current product price (`THB`).
- `sort` (`enum`, default `'popularity'`):
  - `'price_asc'` — Lowest base product price
  - `'total_price_asc'` — Lowest verified total price (offers with known shipping sorted first, `NULLS LAST`)
  - `'price_desc'` — Highest base product price
  - `'popularity'` — Highest outbound click count
  - `'updated_desc'` — Most recently checked offers
- `page` (`int >= 1`, default `1`)
- `limit` (`int 1..50`, default `20`)

**Response (`200 OK`):** Paginated list of products including `lowestProductPrice`, `lowestVerifiedTotalPrice` (`null` if no offer has verified shipping), `offerCount`, `merchantCount`, `currency: "THB"`, and `lastCheckedAt`.

---

### `GET /api/v1/products/:id`
Retrieve canonical product details by UUID or slug, including structured attributes, known identifiers (`EAN`, `MPN`, etc.), price summary, buying recommendation signal, and related product suggestions.

**Response (`200 OK`):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Apple iPhone 16 Pro 256GB Natural Titanium",
    "slug": "apple-iphone-16-pro-256gb-natural-titanium",
    "model": "MYN13TH/A",
    "description": "6.3-inch Super Retina XDR display, A18 Pro chip, 256GB storage.",
    "imageUrl": "https://cdn.pricelens.co.th/products/iphone16pro-256-nat.webp",
    "isDemoData": true,
    "category": { "id": "...", "name": "Smartphones", "slug": "smartphones" },
    "brand": { "id": "...", "name": "Apple", "slug": "apple" },
    "attributes": {
      "storage_capacity": "256GB",
      "ram": "8GB",
      "color": "Natural Titanium",
      "condition": "new"
    },
    "identifiers": [
      { "type": "EAN", "value": "0195949821943" },
      { "type": "MPN", "value": "MYN13TH/A" }
    ],
    "priceSummary": {
      "currency": "THB",
      "lowestProductPrice": "38900.00",
      "lowestVerifiedTotalPrice": "38900.00",
      "offerCount": 4,
      "inStockOfferCount": 3,
      "lastCheckedAt": "2026-11-16T08:00:00.000Z"
    },
    "buyingSignal": {
      "recommendation": "buy_now",
      "reason": "Current lowest price (฿38,900.00) is at the 90-day historical minimum.",
      "hasSufficientData": true
    },
    "suggestions": [ ... ]
  }
}
```

---

### `GET /api/v1/products/:id/offers`
Retrieve all active merchant offers for a canonical product.

**Query Parameters:**
- `sort` (`'price_asc' | 'total_price_asc' | 'updated_desc' | 'merchant_asc'`, default `'price_asc'`)
- `inStockOnly` (`boolean`, default `false`)

**Response (`200 OK`):**
```json
{
  "data": [
    {
      "id": "8f14e45f-ceea-467f-a8f1-4e45fceea67f",
      "merchant": {
        "id": "...",
        "name": "Banana IT",
        "slug": "banana-it",
        "logoUrl": null,
        "verificationStatus": "verified"
      },
      "title": "Apple iPhone 16 Pro 256GB Natural Titanium (MYN13TH/A)",
      "price": "38900.00",
      "shippingCost": "0.00",
      "shippingKnown": true,
      "totalPrice": "38900.00",
      "currency": "THB",
      "availabilityStatus": "in_stock",
      "condition": "new",
      "productUrl": "https://www.bnn.in.th/th/p/...",
      "clickUrl": "/api/v1/offers/8f14e45f-ceea-467f-a8f1-4e45fceea67f/click",
      "isCheapestByProductPrice": true,
      "isCheapestByVerifiedTotalPrice": true,
      "lastCheckedAt": "2026-11-16T08:00:00.000Z"
    },
    {
      "id": "9a25f560-dffb-4780-b902-5f560dffb780",
      "merchant": {
        "id": "...",
        "name": "Advice IT",
        "slug": "advice-it",
        "logoUrl": null,
        "verificationStatus": "verified"
      },
      "title": "iPhone 16 Pro (256GB) Natural Titanium",
      "price": "38800.00",
      "shippingCost": null,
      "shippingKnown": false,
      "totalPrice": null,
      "currency": "THB",
      "availabilityStatus": "in_stock",
      "condition": "new",
      "productUrl": "https://www.advice.co.th/product/...",
      "clickUrl": "/api/v1/offers/9a25f560-dffb-4780-b902-5f560dffb780/click",
      "isCheapestByProductPrice": true,
      "isCheapestByVerifiedTotalPrice": false,
      "lastCheckedAt": "2026-11-16T07:50:00.000Z"
    }
  ]
}
```
*Note how Advice IT has a lower base product price (`38800.00`), but because `shippingCost` is `null` (unknown), `totalPrice` is `null` and `isCheapestByVerifiedTotalPrice` is `false`.*

---

### `GET /api/v1/products/:id/history`
Retrieve authentic historical price snapshots for a canonical product.

**Query Parameters:**
- `period`: `'7d' | '30d' | '90d' | '365d'` (default `'30d'`)

**Response (`200 OK`):**
```json
{
  "data": {
    "productId": "550e8400-e29b-41d4-a716-446655440000",
    "period": "30d",
    "currency": "THB",
    "hasSufficientData": true,
    "stats": {
      "currentLowestPrice": "38800.00",
      "historicalMinPrice": "38800.00",
      "historicalMinRecordedAt": "2026-11-16T07:50:00.000Z",
      "historicalMaxPrice": "41900.00",
      "historicalMaxRecordedAt": "2026-10-20T09:00:00.000Z",
      "lastUpdatedAt": "2026-11-16T08:00:00.000Z"
    },
    "dailySeries": [
      {
        "date": "2026-10-20",
        "minPrice": "41900.00",
        "minVerifiedTotalPrice": "41900.00",
        "maxPrice": "41900.00"
      }
    ]
  }
}
```
If no snapshots exist or fewer than 2 snapshots exist in the requested range, `hasSufficientData` returns `false` and `dailySeries` returns only actual recorded points (never interpolated or fabricated points).

---

### `POST /api/v1/offers/:id/click` (and `GET /api/v1/offers/:id/click`)
Records an outbound affiliate/merchant click in `affiliate_clicks` and returns or redirects to the target URL (`affiliate_url ?? product_url`).

### `GET /api/v1/categories`
Returns hierarchical category tree with active product counts.

### `GET /api/v1/brands`
Returns paginated or full list of active brands with product counts.

### `GET /api/v1/merchants`
Returns list of active merchants, website URLs, verification status, and active offer counts.

---

## 3. Authenticated User API Endpoints (`/api/v1/me/*`)

All endpoints in this section require an authenticated session (`401 UNAUTHORIZED` otherwise).

- `GET /api/v1/me` — Returns current user profile, role, watchlist count, and active alert count.
- `DELETE /api/v1/me` — **Account Deletion Workflow (Section 10):** Requires confirmation payload `{ "confirm": "DELETE" }`, revokes sessions, deletes user record and cascades watchlist/alerts/notifications.
- `GET /api/v1/me/watchlist` — Paginated list of saved products with current lowest price and stock status.
- `POST /api/v1/me/watchlist` — Body: `{ "productId": "<uuid>" }`. Idempotent / returns `409 CONFLICT` if already saved.
- `DELETE /api/v1/me/watchlist/:id` — Removes watchlist entry owned by the authenticated user.
- `GET /api/v1/me/price-alerts` — Lists user's price alerts along with recent notification history.
- `POST /api/v1/me/price-alerts` — Body: `{ "productId": "<uuid>", "targetPrice": "36900.00", "currency": "THB" }`.
- `PATCH /api/v1/me/price-alerts/:id` — Body: `{ "targetPrice"?: "35900.00", "isActive"?: boolean }`.
- `DELETE /api/v1/me/price-alerts/:id` — Deletes a price alert owned by the user.

---

## 4. Admin API Endpoints (`/api/v1/admin/*`)

All endpoints require an authenticated session where `user.role === 'admin'` (`403 FORBIDDEN` otherwise) and write an entry to `audit_logs`.

- `POST /api/v1/admin/products` — Create a canonical product with initial identifiers and attributes.
- `PATCH /api/v1/admin/products/:id` — Update canonical product metadata, status, or attributes.
- `POST /api/v1/admin/categories` & `PATCH /api/v1/admin/categories/:id` — Manage categories.
- `POST /api/v1/admin/brands` & `PATCH /api/v1/admin/brands/:id` — Manage brands.
- `POST /api/v1/admin/merchants` & `PATCH /api/v1/admin/merchants/:id` — Manage merchants.
- `GET /api/v1/admin/data-sources`, `POST /api/v1/admin/data-sources`, `PATCH /api/v1/admin/data-sources/:id` — Manage ingestion sources (validates that secret keys are not passed in `configuration`).
- `POST /api/v1/admin/offers/import` — Upload CSV content or trigger a feed ingestion job. Creates an `ingestion_jobs` record and runs/enqueues the ingestion pipeline.
- `GET /api/v1/admin/ingestion-jobs` — Paginated list of ingestion jobs filterable by `status` and `sourceId`.
- `GET /api/v1/admin/match-candidates` — Paginated list of product match candidates filterable by `reviewStatus` (`pending`, `approved`, `rejected`) and minimum/maximum `confidenceScore`.
- `POST /api/v1/admin/match-candidates/:id/approve` — Approves a candidate (either linking it to the suggested `productId`, an admin-specified `productId`, or creating a new canonical product from `candidate_data`), creates/updates the corresponding `offer` and initial `price_snapshot`, and records `reviewed_at`.
- `POST /api/v1/admin/match-candidates/:id/reject` — Marks candidate `review_status = 'rejected'` and records `reviewed_at` so future identical payloads from the same source are not re-queued for the same rejected product pair.
- `GET /api/v1/admin/reports/data-quality` — Returns counts of products missing identifiers, stale offers (`last_checked_at > 48h`), offers with unknown shipping, and pending match candidates.
