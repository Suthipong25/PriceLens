import { eq } from "drizzle-orm";
import {
  dataSources,
  ingestionJobs,
  type PriceLensDb,
} from "@pricelens/database";
import type { IngestionJobType } from "@pricelens/shared";
import { AffiliateAdapter } from "../adapters/affiliate-adapter.js";
import type { DataSourceAdapter } from "../adapters/adapter.interface.js";
import { CsvAdapter } from "../adapters/csv-adapter.js";
import { MerchantFeedAdapter } from "../adapters/merchant-feed-adapter.js";
import {
  loadCanonicalCatalogForMatching,
  resolveOrQueueProductMatch,
} from "../services/matching.service.js";
import { normalizeSourceRecord } from "../services/normalize.service.js";
import { upsertMerchantAndOffer } from "../services/offer.service.js";
import { recordPriceSnapshotIfNeeded } from "../services/snapshot.service.js";
import { validateSourceRecord } from "../services/validate.service.js";
import { runPriceAlertEvaluation } from "./price-alert.job.js";

export interface IngestionExecutionSummary {
  jobId: string;
  sourceId: string;
  status: "completed" | "failed" | "partial";
  recordsProcessed: number;
  recordsFailed: number;
  autoMatchedCount: number;
  queuedForReviewCount: number;
  snapshotsRecorded: number;
  alertsTriggered: number;
  errors: string[];
}

function resolveAdapter(sourceType: string): DataSourceAdapter {
  switch (sourceType) {
    case "csv":
      return new CsvAdapter();
    case "affiliate_api":
      return new AffiliateAdapter();
    case "merchant_feed":
    case "mock":
    default:
      return new MerchantFeedAdapter();
  }
}

/**
 * Executes the 10-step idempotent PriceLens Data Ingestion Pipeline:
 * 1. Fetch data from an authorized source
 * 2. Validate source data
 * 3. Normalize product attributes
 * 4. Normalize merchant data & calculate verified total_price
 * 5. Find or create product match candidates
 * 6. Match products using deterministic rules
 * 7. Update offers (with source_updated_at freshness guard)
 * 8. Save price snapshots when appropriate
 * 9. Evaluate price alerts
 * 10. Record job results and errors
 */
export async function executeIngestionJob(
  db: PriceLensDb,
  params: {
    sourceId: string;
    jobType?: IngestionJobType;
    payload?: string | Array<Record<string, unknown>>;
  },
): Promise<IngestionExecutionSummary> {
  const [source] = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.id, params.sourceId))
    .limit(1);

  if (!source) {
    throw new Error(`Data source not found: ${params.sourceId}`);
  }
  if (source.status !== "active") {
    throw new Error(`Data source "${source.name}" is not active (status=${source.status})`);
  }

  const startedAt = new Date();
  const jobType: IngestionJobType =
    params.jobType ?? (source.sourceType === "csv" ? "csv_import" : "manual_sync");

  const [jobRow] = await db
    .insert(ingestionJobs)
    .values({
      sourceId: source.id,
      jobType,
      status: "running",
      startedAt,
      recordsProcessed: 0,
      recordsFailed: 0,
    })
    .returning();

  const jobId = jobRow!.id;
  const errors: string[] = [];
  let recordsProcessed = 0;
  let recordsFailed = 0;
  let autoMatchedCount = 0;
  let queuedForReviewCount = 0;
  let snapshotsRecorded = 0;
  const touchedProductIds = new Set<string>();

  try {
    // Step 1: Fetch data from authorized adapter
    const adapter = resolveAdapter(source.sourceType);
    const rawRecords = await adapter.fetchRecords(
      source.configuration,
      params.payload,
    );

    const catalog = await loadCanonicalCatalogForMatching(db);

    for (let idx = 0; idx < rawRecords.length; idx++) {
      const raw = rawRecords[idx]!;

      // Step 2: Validate source data
      const validation = validateSourceRecord(raw);
      if (!validation.valid || !validation.record) {
        recordsFailed++;
        errors.push(
          `Row ${idx + 1}: ${(validation.errors ?? ["Invalid record"]).join("; ")}`,
        );
        continue;
      }

      try {
        // Step 3 & 4: Normalize product attributes, merchant data, and verified total_price
        const normalized = normalizeSourceRecord(validation.record);

        // Step 5 & 6: Deterministic Product Matching or Queue Candidate
        const matchOutcome = await resolveOrQueueProductMatch(
          db,
          source.id,
          normalized,
          catalog,
        );

        if (
          matchOutcome.decision.decision === "auto_matched" &&
          matchOutcome.decision.matchedProductId
        ) {
          autoMatchedCount++;
          const matchedProductId = matchOutcome.decision.matchedProductId;
          touchedProductIds.add(matchedProductId);

          // Step 7: Upsert Offer (with freshness protection)
          const offerUpsert = await upsertMerchantAndOffer(
            db,
            source.id,
            matchedProductId,
            normalized,
          );

          // Step 8: Append Price Snapshot when appropriate
          if (!offerUpsert.wasSkippedStale) {
            const snapRes = await recordPriceSnapshotIfNeeded(db, {
              offerId: offerUpsert.offerId,
              price: normalized.calculatedPrice.price,
              shippingCost: normalized.calculatedPrice.shippingCost,
              totalPrice: normalized.calculatedPrice.totalPrice,
              currency: normalized.calculatedPrice.currency,
              availabilityStatus: normalized.availabilityStatus,
            });
            if (snapRes.recorded) {
              snapshotsRecorded++;
            }
          }
        } else {
          queuedForReviewCount++;
        }

        recordsProcessed++;
      } catch (rowErr) {
        recordsFailed++;
        errors.push(
          `Row ${idx + 1}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`,
        );
      }
    }

    // Step 9: Evaluate Price Alerts for updated canonical products
    let alertsTriggered = 0;
    if (touchedProductIds.size > 0) {
      const alertOutcome = await runPriceAlertEvaluation(
        db,
        Array.from(touchedProductIds),
      );
      alertsTriggered = alertOutcome.notificationsSent;
    }

    // Step 10: Record final job status
    const finalStatus: "completed" | "failed" | "partial" =
      recordsFailed === 0
        ? "completed"
        : recordsProcessed > 0
          ? "partial"
          : "failed";

    await db
      .update(ingestionJobs)
      .set({
        status: finalStatus,
        completedAt: new Date(),
        recordsProcessed,
        recordsFailed,
        errorMessage: errors.length > 0 ? errors.slice(0, 20).join("\n") : null,
      })
      .where(eq(ingestionJobs.id, jobId));

    return {
      jobId,
      sourceId: source.id,
      status: finalStatus,
      recordsProcessed,
      recordsFailed,
      autoMatchedCount,
      queuedForReviewCount,
      snapshotsRecorded,
      alertsTriggered,
      errors,
    };
  } catch (fatalErr) {
    const errMsg = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
    await db
      .update(ingestionJobs)
      .set({
        status: "failed",
        completedAt: new Date(),
        recordsProcessed,
        recordsFailed,
        errorMessage: errMsg,
      })
      .where(eq(ingestionJobs.id, jobId));

    throw fatalErr;
  }
}
