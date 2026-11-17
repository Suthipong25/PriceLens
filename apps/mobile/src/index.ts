import {
  formatPriceTHB,
  formatShippingTHB,
  type ProductSortOption,
} from "@pricelens/shared";
import { mobileApiClient, preparePushNotificationSupport } from "./lib/mobile-api.js";

/**
 * Shared mobile controller logic used by Expo Router screens for search,
 * product comparison, watchlist, and push notification readiness.
 */
export async function loadMobileHomeCatalog(params?: {
  q?: string;
  sort?: ProductSortOption;
}) {
  const [productsRes, categoriesRes] = await Promise.all([
    mobileApiClient.getProducts({
      q: params?.q,
      sort: params?.sort ?? "price_asc",
      limit: 20,
    }),
    mobileApiClient.getCategories(),
  ]);

  return {
    products: productsRes.data.map((p) => ({
      ...p,
      formattedLowestPrice: formatPriceTHB(p.priceSummary.lowestProductPrice),
      formattedVerifiedTotal: p.priceSummary.lowestVerifiedTotalPrice
        ? formatPriceTHB(p.priceSummary.lowestVerifiedTotalPrice)
        : "ไม่ระบุค่าจัดส่ง",
    })),
    categories: categoriesRes.data,
  };
}

export async function loadMobileProductComparison(slugOrId: string) {
  const [detailRes, offersRes, historyRes] = await Promise.all([
    mobileApiClient.getProductById(slugOrId),
    mobileApiClient.getProductOffers(slugOrId, { sort: "total_price_asc" }),
    mobileApiClient.getProductHistory(slugOrId, "30d"),
  ]);

  return {
    product: detailRes.data,
    offers: offersRes.data.map((o) => ({
      ...o,
      formattedPrice: formatPriceTHB(o.price),
      formattedShipping: formatShippingTHB(o.shippingCost),
      formattedTotal:
        o.totalPrice !== null
          ? formatPriceTHB(o.totalPrice)
          : `${formatPriceTHB(o.price)} + ค่าส่งไม่ระบุ`,
    })),
    history: historyRes.data,
  };
}

export { preparePushNotificationSupport };
