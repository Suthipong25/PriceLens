import { eq } from "drizzle-orm";
import { dataSources, type PriceLensDb } from "@pricelens/database";
import {
  executeIngestionJob,
  type IngestionExecutionSummary,
} from "./import-products.job.js";

/**
 * Scheduled synchronization job for all active merchant_feed and affiliate_api sources.
 */
export async function runScheduledOffersSync(
  db: PriceLensDb,
): Promise<IngestionExecutionSummary[]> {
  const activeSources = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.status, "active"));

  const summaries: IngestionExecutionSummary[] = [];
  for (const source of activeSources) {
    if (source.sourceType === "csv") continue;
    const summary = await executeIngestionJob(db, {
      sourceId: source.id,
      jobType: "scheduled_sync",
    });
    summaries.push(summary);
  }
  return summaries;
}
