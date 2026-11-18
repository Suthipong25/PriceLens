import {
  loadMobileHomeCatalog,
  loadMobileProductComparison,
  preparePushNotificationSupport,
} from "./index.js";

/**
 * Expo Router Screen Model: Mobile Home & Search Screen
 */
export async function getMobileHomeScreenState(searchQuery?: string) {
  const [catalog, pushState] = await Promise.all([
    loadMobileHomeCatalog({ q: searchQuery, sort: "price_asc" }),
    preparePushNotificationSupport(),
  ]);

  return {
    screenTitle: "PriceLens Thailand — ค้นหาและเปรียบเทียบราคา",
    searchQuery: searchQuery ?? "",
    pushNotificationStatus: pushState.status,
    categories: catalog.categories,
    products: catalog.products,
  };
}

/**
 * Expo Router Screen Model: Mobile Product Detail & Offer Comparison Screen
 */
export async function getMobileProductDetailScreenState(slug: string) {
  const data = await loadMobileProductComparison(slug);
  return {
    screenTitle: data.product.name,
    product: data.product,
    offers: data.offers,
    history: data.history,
  };
}
