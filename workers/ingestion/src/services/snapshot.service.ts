import { desc, eq } from "drizzle-orm";
import { priceSnapshots, type PriceLensDb } from "@pricelens/database";
import type { AvailabilityStatus } from "@pricelens/shared";

const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Appends a price snapshot when an offer is new, its price/shipping/availability changed,
 * or more than 24h have elapsed since the last snapshot. Never deletes historical snapshots.
 */
export async function recordPriceSnapshotIfNeeded(
  db: PriceLensDb,
  params: {
    offerId: string;
    price: string;
    shippingCost: string | null;
    totalPrice: string | null;
    currency: string;
    availabilityStatus: AvailabilityStatus;
    recordedAt?: Date;
  },
): Promise<{ recorded: boolean; snapshotId: string | null }> {
  const latest = await db
    .select()
    .from(priceSnapshots)
    .where(eq(priceSnapshots.offerId, params.offerId))
    .orderBy(desc(priceSnapshots.recordedAt))
    .limit(1);

  const now = params.recordedAt ?? new Date();
  const prev = latest[0];

  if (prev) {
    const samePrice = Number(prev.price) === Number(params.price);
    const sameShipping =
      (prev.shippingCost === null && params.shippingCost === null) ||
      (prev.shippingCost !== null &&
        params.shippingCost !== null &&
        Number(prev.shippingCost) === Number(params.shippingCost));
    const sameAvailability = prev.availabilityStatus === params.availabilityStatus;
    const elapsedMs = now.getTime() - new Date(prev.recordedAt).getTime();

    if (samePrice && sameShipping && sameAvailability && elapsedMs < HEARTBEAT_INTERVAL_MS) {
      return { recorded: false, snapshotId: prev.id };
    }
  }

  const [inserted] = await db
    .insert(priceSnapshots)
    .values({
      offerId: params.offerId,
      price: params.price,
      shippingCost: params.shippingCost,
      totalPrice: params.totalPrice,
      currency: params.currency,
      availabilityStatus: params.availabilityStatus,
      recordedAt: now,
    })
    .returning();

  return { recorded: true, snapshotId: inserted?.id ?? null };
}
