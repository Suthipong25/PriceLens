import { and, eq, inArray } from "drizzle-orm";
import { evaluatePriceAlertCondition } from "@pricelens/business";
import {
  merchants,
  notifications,
  offers,
  priceAlerts,
  products,
  users,
  type PriceLensDb,
} from "@pricelens/database";

export interface PriceAlertJobResult {
  evaluatedAlerts: number;
  notificationsSent: number;
  duplicatesSuppressed: number;
}

/**
 * Evaluates active price alerts for the specified product IDs (or all active alerts if omitted),
 * sends Resend email notifications when configured, prevents duplicate notifications,
 * and records delivery status in the `notifications` table.
 */
export async function runPriceAlertEvaluation(
  db: PriceLensDb,
  productIds?: string[],
): Promise<PriceAlertJobResult> {
  const alertQuery =
    productIds && productIds.length > 0
      ? db
          .select()
          .from(priceAlerts)
          .where(
            and(
              eq(priceAlerts.isActive, true),
              inArray(priceAlerts.productId, productIds),
            ),
          )
      : db.select().from(priceAlerts).where(eq(priceAlerts.isActive, true));

  const activeAlerts = await alertQuery;
  if (activeAlerts.length === 0) {
    return { evaluatedAlerts: 0, notificationsSent: 0, duplicatesSuppressed: 0 };
  }

  let notificationsSent = 0;
  let duplicatesSuppressed = 0;
  const now = new Date();

  for (const alert of activeAlerts) {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, alert.productId))
      .limit(1);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, alert.userId))
      .limit(1);

    if (!product || !user) continue;

    const productOffers = await db
      .select({
        offerId: offers.id,
        merchantName: merchants.name,
        price: offers.price,
        currency: offers.currency,
        availabilityStatus: offers.availabilityStatus,
        status: offers.status,
      })
      .from(offers)
      .innerJoin(merchants, eq(offers.merchantId, merchants.id))
      .where(eq(offers.productId, alert.productId));

    const evalResult = evaluatePriceAlertCondition(
      {
        alertId: alert.id,
        userId: alert.userId,
        productId: alert.productId,
        targetPrice: alert.targetPrice,
        currency: alert.currency,
        isActive: alert.isActive,
        lastNotifiedAt: alert.lastNotifiedAt,
      },
      product.name,
      productOffers,
      now,
    );

    if (evalResult.status === "suppressed_duplicate" && evalResult.message) {
      duplicatesSuppressed++;
      await db.insert(notifications).values({
        userId: alert.userId,
        alertId: alert.id,
        channel: "email",
        status: "suppressed_duplicate",
        message: evalResult.message,
        sentAt: null,
      });
      continue;
    }

    if (!evalResult.shouldNotify || !evalResult.message) {
      continue;
    }

    // Attempt email delivery via Resend if RESEND_API_KEY is configured, otherwise record safe local delivery
    let deliveryStatus: "sent" | "failed" = "sent";
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey && resendApiKey.trim().length > 0) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM ?? "PriceLens Alerts <alerts@pricelens.co.th>",
            to: [user.email],
            subject: `[PriceLens] ราคาสินค้าลดถึงเป้า: ${product.name}`,
            text: evalResult.message,
          }),
        });
        if (!res.ok) {
          deliveryStatus = "failed";
        }
      } catch {
        deliveryStatus = "failed";
      }
    }

    await db.insert(notifications).values({
      userId: alert.userId,
      alertId: alert.id,
      channel: "email",
      status: deliveryStatus,
      message: evalResult.message,
      sentAt: deliveryStatus === "sent" ? now : null,
    });

    if (deliveryStatus === "sent") {
      notificationsSent++;
      await db
        .update(priceAlerts)
        .set({ lastNotifiedAt: now, updatedAt: now })
        .where(eq(priceAlerts.id, alert.id));
    }
  }

  return {
    evaluatedAlerts: activeAlerts.length,
    notificationsSent,
    duplicatesSuppressed,
  };
}
