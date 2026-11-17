export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "PriceLens Smart Shopping Intelligence API",
    version: "1.0.0",
    description:
      "REST API (/api/v1) for Thailand product discovery, multi-merchant price comparison, deterministic product matching, price history, watchlists, and price alerts.",
  },
  servers: [
    {
      url: "http://localhost:8787",
      description: "Local Development Server",
    },
  ],
  paths: {
    "/api/v1/products": {
      get: {
        summary: "Search and filter canonical products",
        tags: ["Public Catalog"],
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "categorySlug", in: "query", schema: { type: "string" } },
          { name: "brandSlug", in: "query", schema: { type: "string" } },
          { name: "merchantSlug", in: "query", schema: { type: "string" } },
          { name: "minPrice", in: "query", schema: { type: "number" } },
          { name: "maxPrice", in: "query", schema: { type: "number" } },
          {
            name: "sort",
            in: "query",
            schema: {
              type: "string",
              enum: [
                "price_asc",
                "total_price_asc",
                "price_desc",
                "popularity",
                "updated_desc",
              ],
            },
          },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "Paginated product list with lowest offer prices" },
          "400": { description: "Validation error" },
        },
      },
    },
    "/api/v1/products/{id}": {
      get: {
        summary: "Get canonical product details by UUID or slug",
        tags: ["Public Catalog"],
        responses: {
          "200": { description: "Canonical product with priceSummary, buyingSignal, and suggestions" },
          "404": { description: "Product not found" },
        },
      },
    },
    "/api/v1/products/{id}/offers": {
      get: {
        summary: "Get multi-merchant offers for a product",
        tags: ["Public Catalog"],
        responses: {
          "200": { description: "Annotated and sorted merchant offers" },
          "404": { description: "Product not found" },
        },
      },
    },
    "/api/v1/products/{id}/history": {
      get: {
        summary: "Get historical price snapshots (7d, 30d, 90d, 365d)",
        tags: ["Public Catalog"],
        responses: {
          "200": { description: "Price history series, min/max stats, and buyingSignal" },
        },
      },
    },
    "/api/v1/categories": {
      get: { summary: "List categories", tags: ["Public Catalog"] },
    },
    "/api/v1/brands": {
      get: { summary: "List brands", tags: ["Public Catalog"] },
    },
    "/api/v1/merchants": {
      get: { summary: "List merchants", tags: ["Public Catalog"] },
    },
    "/api/v1/offers/{id}/click": {
      post: {
        summary: "Record outbound affiliate click and return redirect URL",
        tags: ["Affiliate Tracking"],
      },
    },
    "/api/v1/me": {
      get: { summary: "Get current authenticated user profile", tags: ["User"] },
      delete: { summary: "Delete current user account (PDPA compliance)", tags: ["User"] },
    },
    "/api/v1/me/watchlist": {
      get: { summary: "List user watchlist", tags: ["User"] },
      post: { summary: "Add product to watchlist", tags: ["User"] },
    },
    "/api/v1/me/watchlist/{id}": {
      delete: { summary: "Remove item from watchlist", tags: ["User"] },
    },
    "/api/v1/me/price-alerts": {
      get: { summary: "List user price alerts", tags: ["User"] },
      post: { summary: "Create target price alert", tags: ["User"] },
    },
    "/api/v1/me/price-alerts/{id}": {
      patch: { summary: "Update target price or toggle active state", tags: ["User"] },
      delete: { summary: "Delete price alert", tags: ["User"] },
    },
    "/api/v1/admin/products": {
      post: { summary: "Create canonical product", tags: ["Admin"] },
    },
    "/api/v1/admin/products/{id}": {
      patch: { summary: "Update canonical product", tags: ["Admin"] },
    },
    "/api/v1/admin/offers/import": {
      post: { summary: "Import offers via CSV or feed source", tags: ["Admin"] },
    },
    "/api/v1/admin/ingestion-jobs": {
      get: { summary: "Monitor ingestion jobs", tags: ["Admin"] },
    },
    "/api/v1/admin/match-candidates": {
      get: { summary: "List product matching review queue", tags: ["Admin"] },
    },
    "/api/v1/admin/match-candidates/{id}/approve": {
      post: { summary: "Approve match candidate and link offer", tags: ["Admin"] },
    },
    "/api/v1/admin/match-candidates/{id}/reject": {
      post: { summary: "Reject match candidate", tags: ["Admin"] },
    },
  },
};
