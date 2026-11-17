import type { AvailabilityStatus } from "@pricelens/shared";

export interface PriceAlertEvaluationInput {
  alertId: string;
  userId: string;
  productId: string;
  targetPrice: string;
  currency: string;
  isActive: boolean;
  lastNotifiedAt: Date | string | null;
}

export interface OfferForAlertEvaluation {
  offerId: string;
  merchantName: string;
  price: string;
  currency: string;
  availabilityStatus: AvailabilityStatus;
  status: string;
}

export interface AlertEvaluationResult {
  shouldNotify: boolean;
  status: "triggered" | "not_reached" | "inactive" | "suppressed_duplicate" | "out_of_stock";
  matchedOffer: OfferForAlertEvaluation | null;
  message: string | null;
}

const DEFAULT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Evaluates whether a user's price alert should fire and suppresses duplicate notifications.
 */
export function evaluatePriceAlertCondition(
  alert: PriceAlertEvaluationInput,
  productName: string,
  offers: OfferForAlertEvaluation[],
  now: Date = new Date(),
  cooldownMs: number = DEFAULT_COOLDOWN_MS,
): AlertEvaluationResult {
  if (!alert.isActive) {
    return {
      shouldNotify: false,
      status: "inactive",
      matchedOffer: null,
      message: null,
    };
  }

  const eligibleOffers = offers
    .filter(
      (o) =>
        o.status === "active" &&
        o.availabilityStatus === "in_stock" &&
        o.currency === alert.currency,
    )
    .sort((a, b) => Number(a.price) - Number(b.price));

  if (eligibleOffers.length === 0) {
    return {
      shouldNotify: false,
      status: "out_of_stock",
      matchedOffer: null,
      message: null,
    };
  }

  const lowestOffer = eligibleOffers[0]!;
  const currentPrice = Number(lowestOffer.price);
  const targetPrice = Number(alert.targetPrice);

  if (currentPrice > targetPrice) {
    return {
      shouldNotify: false,
      status: "not_reached",
      matchedOffer: lowestOffer,
      message: null,
    };
  }

  if (alert.lastNotifiedAt) {
    const elapsed = now.getTime() - new Date(alert.lastNotifiedAt).getTime();
    if (elapsed < cooldownMs) {
      return {
        shouldNotify: false,
        status: "suppressed_duplicate",
        matchedOffer: lowestOffer,
        message: `ระงับการส่งซ้ำเนื่องจากเพิ่งแจ้งเตือนไปเมื่อ ${new Date(alert.lastNotifiedAt).toISOString()}`,
      };
    }
  }

  return {
    shouldNotify: true,
    status: "triggered",
    matchedOffer: lowestOffer,
    message: `ราคาสินค้า "${productName}" ลดลงมาที่ ฿${currentPrice.toLocaleString("th-TH", { minimumFractionDigits: 2 })} จากร้าน ${lowestOffer.merchantName} (เป้าหมายของคุณ: ฿${targetPrice.toLocaleString("th-TH", { minimumFractionDigits: 2 })})`,
  };
}
