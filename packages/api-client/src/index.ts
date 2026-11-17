import type {
  AvailabilityStatus,
  BuyingSignal,
  HistoryPeriod,
  IdentifierType,
  MatchReviewStatus,
  OfferSortOption,
  ProductAttributes,
  ProductCondition,
  ProductSortOption,
  UserRole,
} from "@pricelens/shared";

export interface ApiPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface ProductPriceSummary {
  currency: string;
  lowestProductPrice: string | null;
  lowestVerifiedTotalPrice: string | null;
  highestProductPrice?: string | null;
  offerCount: number;
  inStockOfferCount?: number;
  merchantCount?: number;
  lastCheckedAt: string;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  model: string | null;
  description: string | null;
  imageUrl: string | null;
  attributes: ProductAttributes;
  isDemoData: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
    parentId?: string | null;
  };
  brand: {
    id: string;
    name: string;
    slug: string;
  };
  identifiers: Array<{ type: IdentifierType | string; value: string }>;
  priceSummary: ProductPriceSummary;
}

export interface ProductDetail extends ProductListItem {
  buyingSignal: {
    recommendation: BuyingSignal;
    reason: string;
    hasSufficientData: boolean;
  };
  suggestions: Array<{
    id: string;
    name: string;
    slug: string;
    model: string | null;
    imageUrl: string | null;
    attributes: ProductAttributes;
  }>;
}

export interface MerchantOfferItem {
  id: string;
  title: string;
  price: string;
  shippingCost: string | null;
  shippingKnown: boolean;
  totalPrice: string | null;
  currency: string;
  availabilityStatus: AvailabilityStatus;
  condition: ProductCondition;
  productUrl: string;
  affiliateUrl?: string | null;
  clickUrl: string;
  isCheapestByProductPrice: boolean;
  isCheapestByVerifiedTotalPrice: boolean;
  lastCheckedAt: string;
  merchant: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    verificationStatus: string;
  };
}

export interface ProductHistoryResponse {
  productId: string;
  period: HistoryPeriod;
  currency: string;
  hasSufficientData: boolean;
  stats: {
    currentLowestPrice: string | null;
    historicalMinPrice: string | null;
    historicalMinRecordedAt: string | null;
    historicalMaxPrice: string | null;
    historicalMaxRecordedAt: string | null;
    lastUpdatedAt: string | null;
  };
  buyingSignal: {
    recommendation: BuyingSignal;
    reason: string;
    hasSufficientData: boolean;
  };
  dailySeries: Array<{
    date: string;
    minPrice: string;
    minVerifiedTotalPrice: string | null;
    maxPrice: string;
  }>;
}

export interface CategoryItem {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  productCount: number;
}

export interface BrandItem {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

export interface MerchantItem {
  id: string;
  name: string;
  slug: string;
  website: string;
  logoUrl: string | null;
  verificationStatus: string;
  status: string;
  activeOfferCount: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  stats: {
    watchlistCount: number;
    totalAlertsCount: number;
    activeAlertsCount: number;
  };
}

export interface PriceLensClientOptions {
  baseUrl?: string;
  getAuthToken?: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export class PriceLensApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Array<{ field?: string; issue: string }>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Array<{ field?: string; issue: string }> = [],
  ) {
    super(message);
    this.name = "PriceLensApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createPriceLensClient(options: PriceLensClientOptions = {}) {
  const baseUrl = (
    options.baseUrl ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8787/api/v1"
  ).replace(/\/+$/, "");

  const fetchFn = options.fetchImpl ?? fetch;

  async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type") && init.body) {
      headers.set("Content-Type", "application/json");
    }

    if (options.getAuthToken) {
      const token = await options.getAuthToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    const res = await fetchFn(`${baseUrl}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });

    const json = (await res.json().catch(() => null)) as
      | {
          data?: T;
          pagination?: ApiPagination;
          error?: {
            code: string;
            message: string;
            details?: Array<{ field?: string; issue: string }>;
          };
        }
      | null;

    if (!res.ok || !json || json.error) {
      throw new PriceLensApiError(
        res.status,
        json?.error?.code ?? "API_ERROR",
        json?.error?.message ?? `HTTP Error ${res.status}`,
        json?.error?.details ?? [],
      );
    }

    return json as unknown as T;
  }

  return {
    async getProducts(params?: {
      q?: string;
      categorySlug?: string;
      brandSlug?: string;
      merchantSlug?: string;
      minPrice?: number;
      maxPrice?: number;
      sort?: ProductSortOption;
      page?: number;
      limit?: number;
    }) {
      const sp = new URLSearchParams();
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== null && String(v) !== "") {
            sp.set(k, String(v));
          }
        }
      }
      const qs = sp.toString();
      return request<{ data: ProductListItem[]; pagination: ApiPagination }>(
        `/products${qs ? `?${qs}` : ""}`,
      );
    },

    async getProductById(idOrSlug: string) {
      return request<{ data: ProductDetail }>(
        `/products/${encodeURIComponent(idOrSlug)}`,
      );
    },

    async getProductOffers(
      idOrSlug: string,
      params?: { sort?: OfferSortOption; inStockOnly?: boolean },
    ) {
      const sp = new URLSearchParams();
      if (params?.sort) sp.set("sort", params.sort);
      if (params?.inStockOnly !== undefined) {
        sp.set("inStockOnly", String(params.inStockOnly));
      }
      const qs = sp.toString();
      return request<{ data: MerchantOfferItem[] }>(
        `/products/${encodeURIComponent(idOrSlug)}/offers${qs ? `?${qs}` : ""}`,
      );
    },

    async getProductHistory(idOrSlug: string, period: HistoryPeriod = "30d") {
      return request<{ data: ProductHistoryResponse }>(
        `/products/${encodeURIComponent(idOrSlug)}/history?period=${period}`,
      );
    },

    async getCategories() {
      return request<{ data: CategoryItem[] }>("/categories");
    },

    async getBrands() {
      return request<{ data: BrandItem[] }>("/brands");
    },

    async getMerchants() {
      return request<{ data: MerchantItem[] }>("/merchants");
    },

    async trackOfferClick(offerId: string) {
      return request<{
        data: {
          offerId: string;
          trackingId: string;
          targetUrl: string;
          isAffiliateLink: boolean;
        };
      }>(`/offers/${encodeURIComponent(offerId)}/click`, {
        method: "POST",
      });
    },

    async getMe() {
      return request<{ data: UserProfile }>("/me");
    },

    async deleteMe() {
      return request<{ data: { deleted: boolean; userId: string } }>("/me", {
        method: "DELETE",
        body: JSON.stringify({ confirm: "DELETE" }),
      });
    },

    async getWatchlist() {
      return request<{
        data: Array<{
          id: string;
          productId: string;
          createdAt: string;
          lowestProductPrice: string | null;
          offerCount: number;
          currency: string;
          product: {
            id: string;
            name: string;
            slug: string;
            model: string | null;
            imageUrl: string | null;
            attributes: ProductAttributes;
          };
          brand: { id: string; name: string; slug: string };
        }>;
      }>("/me/watchlist");
    },

    async addToWatchlist(productId: string) {
      return request<{ data: { id: string; productId: string } }>(
        "/me/watchlist",
        {
          method: "POST",
          body: JSON.stringify({ productId }),
        },
      );
    },

    async removeFromWatchlist(watchlistId: string) {
      return request<{ data: { deleted: boolean; id: string } }>(
        `/me/watchlist/${encodeURIComponent(watchlistId)}`,
        { method: "DELETE" },
      );
    },

    async getPriceAlerts() {
      return request<{
        data: {
          alerts: Array<{
            id: string;
            productId: string;
            targetPrice: string;
            currency: string;
            isActive: boolean;
            lastNotifiedAt: string | null;
            createdAt: string;
            product: {
              id: string;
              name: string;
              slug: string;
              imageUrl: string | null;
            };
          }>;
          recentNotifications: Array<{
            id: string;
            alertId: string;
            channel: string;
            status: string;
            message: string;
            sentAt: string | null;
            createdAt: string;
          }>;
        };
      }>("/me/price-alerts");
    },

    async createPriceAlert(input: {
      productId: string;
      targetPrice: string | number;
    }) {
      return request<{ data: { id: string; targetPrice: string } }>(
        "/me/price-alerts",
        {
          method: "POST",
          body: JSON.stringify({ ...input, currency: "THB" }),
        },
      );
    },

    async updatePriceAlert(
      alertId: string,
      input: { targetPrice?: string | number; isActive?: boolean },
    ) {
      return request<{ data: { id: string; isActive: boolean } }>(
        `/me/price-alerts/${encodeURIComponent(alertId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      );
    },

    async deletePriceAlert(alertId: string) {
      return request<{ data: { deleted: boolean; id: string } }>(
        `/me/price-alerts/${encodeURIComponent(alertId)}`,
        { method: "DELETE" },
      );
    },

    // Admin Endpoints
    async getMatchCandidates(reviewStatus?: MatchReviewStatus) {
      const qs = reviewStatus ? `?reviewStatus=${reviewStatus}` : "";
      return request<{
        data: Array<{
          id: string;
          productId: string | null;
          sourceId: string;
          sourceName: string;
          externalProductId: string;
          candidateData: Record<string, unknown>;
          confidenceScore: string;
          matchingReasons: string[];
          reviewStatus: MatchReviewStatus;
          createdAt: string;
          reviewedAt: string | null;
        }>;
      }>(`/admin/match-candidates${qs}`);
    },

    async approveMatchCandidate(candidateId: string, productId?: string) {
      return request<{
        data: {
          candidate: { id: string; reviewStatus: string };
          linkedProductId: string;
          offerId: string | null;
        };
      }>(`/admin/match-candidates/${encodeURIComponent(candidateId)}/approve`, {
        method: "POST",
        body: JSON.stringify(productId ? { productId } : {}),
      });
    },

    async rejectMatchCandidate(candidateId: string, reason?: string) {
      return request<{ data: { id: string; reviewStatus: string } }>(
        `/admin/match-candidates/${encodeURIComponent(candidateId)}/reject`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        },
      );
    },

    async getIngestionJobs() {
      return request<{
        data: Array<{
          id: string;
          sourceId: string;
          sourceName: string;
          sourceType: string;
          jobType: string;
          status: string;
          startedAt: string | null;
          completedAt: string | null;
          recordsProcessed: number;
          recordsFailed: number;
          errorMessage: string | null;
          createdAt: string;
        }>;
      }>("/admin/ingestion-jobs");
    },

    async getDataSources() {
      return request<{
        data: Array<{
          id: string;
          name: string;
          sourceType: string;
          configuration: Record<string, unknown>;
          status: string;
          createdAt: string;
        }>;
      }>("/admin/data-sources");
    },

    async importCsvOffers(sourceId: string, csvContent: string) {
      return request<{
        data: {
          jobId: string;
          status: string;
          recordsProcessed: number;
          recordsFailed: number;
          autoMatchedCount: number;
          queuedForReviewCount: number;
          snapshotsRecorded: number;
          alertsTriggered: number;
          errors: string[];
        };
      }>("/admin/offers/import", {
        method: "POST",
        body: JSON.stringify({
          sourceId,
          format: "csv",
          csvContent,
        }),
      });
    },

    async getDataQualityReport() {
      return request<{
        data: {
          totalProducts: number;
          totalOffers: number;
          productsMissingIdentifiers: number;
          staleOffersCount: number;
          offersWithUnknownShippingCount: number;
          pendingMatchCandidatesCount: number;
        };
      }>("/admin/reports/data-quality");
    },
  };
}
