import { and, eq } from "drizzle-orm";
import { merchants, offers, type PriceLensDb } from "@pricelens/database";
import type { NormalizedSourceRecord } from "./normalize.service.js";

export interface OfferUpsertResult {
  offerId: string;
  wasUpdated: boolean;
  wasSkippedStale: boolean;
}

/**
 * Finds or creates the merchant and upserts the offer.
 * Prevents older source records (source_updated_at) from overwriting newer data.
 */
export async function upsertMerchantAndOffer(
  db: PriceLensDb,
  sourceId: string,
  productId: string,
  record: NormalizedSourceRecord,
): Promise<OfferUpsertResult> {
  // 1. Find or create Merchant
  const existingMerchants = await db
    .select()
    .from(merchants)
    .where(eq(merchants.slug, record.merchantSlugNormalized))
    .limit(1);

  let merchantId = existingMerchants[0]?.id;

  if (!merchantId) {
    const [createdMerchant] = await db
      .insert(merchants)
      .values({
        name: record.merchantName,
        slug: record.merchantSlugNormalized,
        website: record.merchantWebsite,
        verificationStatus:
          record.merchantVerified === true
            ? "verified"
            : record.merchantVerified === false
              ? "unverified"
              : "unknown",
        status: "active",
      })
      .returning();
    merchantId = createdMerchant!.id;
  }

  // 2. Check existing offer for (source_id, external_product_id)
  const existingOffers = await db
    .select()
    .from(offers)
    .where(
      and(
        eq(offers.sourceId, sourceId),
        eq(offers.externalProductId, record.externalProductId),
      ),
    )
    .limit(1);

  const incomingSourceDate = record.sourceUpdatedAt
    ? new Date(record.sourceUpdatedAt)
    : null;
  const now = new Date();

  const existingOffer = existingOffers[0];
  if (existingOffer) {
    // Freshness Guard: Never overwrite newer offer data with an older source timestamp
    if (
      incomingSourceDate &&
      existingOffer.sourceUpdatedAt &&
      incomingSourceDate.getTime() < existingOffer.sourceUpdatedAt.getTime()
    ) {
      return {
        offerId: existingOffer.id,
        wasUpdated: false,
        wasSkippedStale: true,
      };
    }

    await db
      .update(offers)
      .set({
        productId,
        merchantId,
        title: record.title,
        productUrl: record.productUrl,
        affiliateUrl: record.affiliateUrl ?? existingOffer.affiliateUrl,
        price: record.calculatedPrice.price,
        currency: record.calculatedPrice.currency,
        shippingCost: record.calculatedPrice.shippingCost,
        totalPrice: record.calculatedPrice.totalPrice,
        availabilityStatus: record.availabilityStatus,
        condition: record.condition,
        sourceUpdatedAt: incomingSourceDate ?? existingOffer.sourceUpdatedAt,
        lastCheckedAt: now,
        status: "active",
        updatedAt: now,
      })
      .where(eq(offers.id, existingOffer.id));

    return {
      offerId: existingOffer.id,
      wasUpdated: true,
      wasSkippedStale: false,
    };
  }

  const [createdOffer] = await db
    .insert(offers)
    .values({
      productId,
      merchantId,
      sourceId,
      externalProductId: record.externalProductId,
      title: record.title,
      productUrl: record.productUrl,
      affiliateUrl: record.affiliateUrl ?? null,
      price: record.calculatedPrice.price,
      currency: record.calculatedPrice.currency,
      shippingCost: record.calculatedPrice.shippingCost,
      totalPrice: record.calculatedPrice.totalPrice,
      availabilityStatus: record.availabilityStatus,
      condition: record.condition,
      sourceUpdatedAt: incomingSourceDate,
      lastCheckedAt: now,
      status: "active",
    })
    .returning();

  return {
    offerId: createdOffer!.id,
    wasUpdated: true,
    wasSkippedStale: false,
  };
}
