import {
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  toDecimalString,
  type AvailabilityStatus,
  type BuyingSignal,
  type OfferSortOption,
  type ProductCondition,
} from "@pricelens/shared";

export interface CalculatedOfferPrice {
  price: string;
  shippingCost: string | null;
  shippingKnown: boolean;
  totalPrice: string | null;
  currency: string;
}

/**
 * Calculates total_price = product_price + shipping_cost ONLY when shipping_cost is known.
 * Explicitly distinguishes shipping_cost = 0 ("0.00") from unknown shipping (null).
 * Rejects unsupported or mismatched currencies.
 */
export function calculateOfferTotalPrice(
  productPrice: string | number,
  shippingCost: string | number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): CalculatedOfferPrice {
  const normalizedCurrency = currency.trim().toUpperCase();
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(normalizedCurrency)) {
    throw new Error(
      `Unsupported currency "${currency}". Only ${SUPPORTED_CURRENCIES.join(", ")} is supported without explicit conversion.`,
    );
  }

  const priceDec = toDecimalString(productPrice);
  const priceCents = Math.round(Number(priceDec) * 100);
  if (priceCents < 0) {
    throw new Error("Product price cannot be negative.");
  }

  if (
    shippingCost === null ||
    shippingCost === undefined ||
    String(shippingCost).trim() === ""
  ) {
    return {
      price: priceDec,
      shippingCost: null,
      shippingKnown: false,
      totalPrice: null,
      currency: normalizedCurrency,
    };
  }

  const shippingDec = toDecimalString(shippingCost);
  const shippingCents = Math.round(Number(shippingDec) * 100);
  if (shippingCents < 0) {
    throw new Error("Shipping cost cannot be negative.");
  }

  const totalDec = ((priceCents + shippingCents) / 100).toFixed(2);

  return {
    price: priceDec,
    shippingCost: shippingDec,
    shippingKnown: true,
    totalPrice: totalDec,
    currency: normalizedCurrency,
  };
}

export interface ComparableOfferInput {
  id: string;
  merchant: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    verificationStatus: string;
  };
  title: string;
  price: string;
  shippingCost: string | null;
  totalPrice: string | null;
  currency: string;
  availabilityStatus: AvailabilityStatus;
  condition: ProductCondition;
  productUrl: string;
  affiliateUrl?: string | null;
  lastCheckedAt: Date | string;
}

export interface AnnotatedOffer extends ComparableOfferInput {
  shippingKnown: boolean;
  isCheapestByProductPrice: boolean;
  isCheapestByVerifiedTotalPrice: boolean;
  clickUrl: string;
}

/**
 * Annotates offers with cheapest badges (never claiming an offer with unknown shipping
 * is cheapest by total cost) and sorts according to user preference.
 */
export function annotateAndSortOffers(
  offers: ComparableOfferInput[],
  sort: OfferSortOption = "price_asc",
): AnnotatedOffer[] {
  if (offers.length === 0) return [];

  // Ensure no currency mixing
  const currencies = new Set(offers.map((o) => o.currency));
  if (currencies.size > 1) {
    throw new Error(
      `Cannot compare offers across multiple currencies (${Array.from(currencies).join(", ")}) without conversion.`,
    );
  }

  const inStockOffers = offers.filter((o) => o.availabilityStatus === "in_stock");
  const poolForCheapest = inStockOffers.length > 0 ? inStockOffers : offers;

  const minProductPrice = Math.min(
    ...poolForCheapest.map((o) => Number(o.price)),
  );

  const verifiedTotalOffers = poolForCheapest.filter(
    (o) => o.shippingCost !== null && o.totalPrice !== null,
  );
  const minVerifiedTotalPrice =
    verifiedTotalOffers.length > 0
      ? Math.min(...verifiedTotalOffers.map((o) => Number(o.totalPrice)))
      : null;

  const annotated: AnnotatedOffer[] = offers.map((offer) => {
    const shippingKnown = offer.shippingCost !== null && offer.totalPrice !== null;
    const eligible = inStockOffers.length === 0 || offer.availabilityStatus === "in_stock";

    return {
      ...offer,
      shippingKnown,
      isCheapestByProductPrice:
        eligible && Number(offer.price) === minProductPrice,
      isCheapestByVerifiedTotalPrice:
        eligible &&
        shippingKnown &&
        minVerifiedTotalPrice !== null &&
        Number(offer.totalPrice) === minVerifiedTotalPrice,
      clickUrl: `/api/v1/offers/${offer.id}/click`,
    };
  });

  return annotated.sort((a, b) => {
    switch (sort) {
      case "price_asc":
        return Number(a.price) - Number(b.price);
      case "total_price_asc": {
        // Known total_price always ranks ahead of unknown shipping (NULLS LAST)
        if (a.totalPrice !== null && b.totalPrice !== null) {
          return Number(a.totalPrice) - Number(b.totalPrice);
        }
        if (a.totalPrice !== null) return -1;
        if (b.totalPrice !== null) return 1;
        return Number(a.price) - Number(b.price);
      }
      case "updated_desc":
        return (
          new Date(b.lastCheckedAt).getTime() -
          new Date(a.lastCheckedAt).getTime()
        );
      case "merchant_asc":
        return a.merchant.name.localeCompare(b.merchant.name, "th");
      default:
        return Number(a.price) - Number(b.price);
    }
  });
}

export interface SnapshotPoint {
  price: string;
  shippingCost: string | null;
  totalPrice: string | null;
  recordedAt: Date | string;
}

export interface PriceHistoryAnalysis {
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

/**
 * Aggregates真实 (authentic) price snapshots without fabricating missing days.
 */
export function analyzePriceHistory(
  snapshots: SnapshotPoint[],
  currentLowestPrice: string | null,
): PriceHistoryAnalysis {
  if (snapshots.length === 0) {
    return {
      hasSufficientData: false,
      stats: {
        currentLowestPrice,
        historicalMinPrice: currentLowestPrice,
        historicalMinRecordedAt: null,
        historicalMaxPrice: currentLowestPrice,
        historicalMaxRecordedAt: null,
        lastUpdatedAt: null,
      },
      buyingSignal: {
        recommendation: "insufficient_data",
        reason: "เพิ่งเริ่มเก็บข้อมูลราคา จึงยังไม่มีประวัติราคาเพียงพอสำหรับการวิเคราะห์จังหวะซื้อ",
        hasSufficientData: false,
      },
      dailySeries: [],
    };
  }

  let minPoint = snapshots[0]!;
  let maxPoint = snapshots[0]!;
  let latestPoint = snapshots[0]!;

  const byDate = new Map<
    string,
    { minPrice: number; minTotal: number | null; maxPrice: number }
  >();

  for (const snap of snapshots) {
    const p = Number(snap.price);
    const t = snap.totalPrice !== null ? Number(snap.totalPrice) : null;
    const recDate = new Date(snap.recordedAt);
    const dayKey = recDate.toISOString().slice(0, 10);

    if (p < Number(minPoint.price)) minPoint = snap;
    if (p > Number(maxPoint.price)) maxPoint = snap;
    if (recDate.getTime() > new Date(latestPoint.recordedAt).getTime()) {
      latestPoint = snap;
    }

    const existing = byDate.get(dayKey);
    if (!existing) {
      byDate.set(dayKey, { minPrice: p, minTotal: t, maxPrice: p });
    } else {
      existing.minPrice = Math.min(existing.minPrice, p);
      existing.maxPrice = Math.max(existing.maxPrice, p);
      if (t !== null) {
        existing.minTotal =
          existing.minTotal === null ? t : Math.min(existing.minTotal, t);
      }
    }
  }

  const dailySeries = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      minPrice: vals.minPrice.toFixed(2),
      minVerifiedTotalPrice:
        vals.minTotal !== null ? vals.minTotal.toFixed(2) : null,
      maxPrice: vals.maxPrice.toFixed(2),
    }));

  const hasSufficientData = dailySeries.length >= 2;
  const effectiveCurrent =
    currentLowestPrice !== null ? Number(currentLowestPrice) : Number(latestPoint.price);
  const histMin = Number(minPoint.price);
  const histMax = Number(maxPoint.price);
  const avgPrice =
    dailySeries.reduce((acc, d) => acc + Number(d.minPrice), 0) /
    dailySeries.length;

  let recommendation: BuyingSignal = "insufficient_data";
  let reason =
    "เพิ่งเริ่มเก็บข้อมูลราคา จึงยังไม่มีประวัติราคาเพียงพอสำหรับการวิเคราะห์จังหวะซื้อ";

  if (hasSufficientData) {
    if (effectiveCurrent <= histMin * 1.03) {
      recommendation = "buy_now";
      reason = `ราคาปัจจุบัน (฿${effectiveCurrent.toLocaleString("th-TH", { minimumFractionDigits: 2 })}) อยู่ในระดับต่ำสุดของประวัติที่บันทึกไว้ (ต่ำสุด ฿${histMin.toLocaleString("th-TH", { minimumFractionDigits: 2 })})`;
    } else if (effectiveCurrent > avgPrice * 1.08) {
      recommendation = "wait";
      reason = `ราคาปัจจุบันสูงกว่าค่าเฉลี่ยย้อนหลัง (฿${avgPrice.toLocaleString("th-TH", { minimumFractionDigits: 2 })}) เกิน 8% แนะนำให้ตั้งแจ้งเตือนราคา`;
    } else {
      recommendation = "typical_price";
      reason = `ราคาปัจจุบันอยู่ในเกณฑ์ปกติเมื่อเทียบกับประวัติย้อนหลัง (ต่ำสุด ฿${histMin.toLocaleString("th-TH", { minimumFractionDigits: 2 })} / สูงสุด ฿${histMax.toLocaleString("th-TH", { minimumFractionDigits: 2 })})`;
    }
  }

  return {
    hasSufficientData,
    stats: {
      currentLowestPrice: effectiveCurrent.toFixed(2),
      historicalMinPrice: histMin.toFixed(2),
      historicalMinRecordedAt: new Date(minPoint.recordedAt).toISOString(),
      historicalMaxPrice: histMax.toFixed(2),
      historicalMaxRecordedAt: new Date(maxPoint.recordedAt).toISOString(),
      lastUpdatedAt: new Date(latestPoint.recordedAt).toISOString(),
    },
    buyingSignal: {
      recommendation,
      reason,
      hasSufficientData,
    },
    dailySeries,
  };
}
