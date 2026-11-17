import { and, eq } from "drizzle-orm";
import {
  matchProductDeterministically,
  type CanonicalProductCandidate,
  type ProductMatchDecision,
} from "@pricelens/business";
import {
  brands,
  productIdentifiers,
  productMatchCandidates,
  products,
  type PriceLensDb,
} from "@pricelens/database";
import type { NormalizedSourceRecord } from "./normalize.service.js";

export async function loadCanonicalCatalogForMatching(
  db: PriceLensDb,
): Promise<CanonicalProductCandidate[]> {
  const activeProducts = await db
    .select({
      id: products.id,
      name: products.name,
      model: products.model,
      attributes: products.attributes,
      brandName: brands.name,
    })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .where(eq(products.status, "active"));

  const allIdentifiers = await db.select().from(productIdentifiers);
  const idsByProduct = new Map<
    string,
    Array<{ type: typeof allIdentifiers[number]["type"]; value: string }>
  >();

  for (const idRow of allIdentifiers) {
    const list = idsByProduct.get(idRow.productId) ?? [];
    list.push({ type: idRow.type, value: idRow.value });
    idsByProduct.set(idRow.productId, list);
  }

  return activeProducts.map((p) => ({
    id: p.id,
    name: p.name,
    brandName: p.brandName,
    model: p.model,
    attributes: p.attributes,
    identifiers: idsByProduct.get(p.id) ?? [],
  }));
}

export async function resolveOrQueueProductMatch(
  db: PriceLensDb,
  sourceId: string,
  record: NormalizedSourceRecord,
  catalog: CanonicalProductCandidate[],
): Promise<{
  decision: ProductMatchDecision;
  candidateId: string | null;
}> {
  // Check if an admin previously approved or rejected this exact source + external_product_id
  const existingCandidates = await db
    .select()
    .from(productMatchCandidates)
    .where(
      and(
        eq(productMatchCandidates.sourceId, sourceId),
        eq(productMatchCandidates.externalProductId, record.externalProductId),
      ),
    );

  const approved = existingCandidates.find(
    (c) => c.reviewStatus === "approved" && c.productId !== null,
  );
  if (approved && approved.productId) {
    return {
      decision: {
        decision: "auto_matched",
        matchedProductId: approved.productId,
        confidenceScore: Number(approved.confidenceScore),
        matchingReasons: [
          ...approved.matchingReasons,
          "PREVIOUSLY_APPROVED_BY_ADMIN",
        ],
        normalizedAttributes: record.normalizedAttributes,
      },
      candidateId: approved.id,
    };
  }

  const decision = matchProductDeterministically(
    {
      externalProductId: record.externalProductId,
      title: record.title,
      brandName: record.brandName,
      model: record.model,
      gtin: record.gtin,
      ean: record.ean,
      upc: record.upc,
      mpn: record.mpn,
      sku: record.sku,
      condition: record.condition,
      attributes: record.normalizedAttributes,
    },
    catalog,
  );

  if (decision.decision === "auto_matched" && decision.matchedProductId) {
    return { decision, candidateId: null };
  }

  // Uncertain or unmatched -> Upsert into product_match_candidates for Admin review
  const existingPendingOrRejected = existingCandidates.find(
    (c) => c.productId === decision.matchedProductId,
  );

  if (existingPendingOrRejected) {
    if (existingPendingOrRejected.reviewStatus === "rejected") {
      return { decision, candidateId: existingPendingOrRejected.id };
    }
    await db
      .update(productMatchCandidates)
      .set({
        candidateData: record as unknown as Record<string, unknown>,
        confidenceScore: decision.confidenceScore.toFixed(2),
        matchingReasons: decision.matchingReasons,
      })
      .where(eq(productMatchCandidates.id, existingPendingOrRejected.id));

    return { decision, candidateId: existingPendingOrRejected.id };
  }

  const [inserted] = await db
    .insert(productMatchCandidates)
    .values({
      productId: decision.matchedProductId,
      sourceId,
      externalProductId: record.externalProductId,
      candidateData: record as unknown as Record<string, unknown>,
      confidenceScore: decision.confidenceScore.toFixed(2),
      matchingReasons: decision.matchingReasons,
      reviewStatus: "pending",
    })
    .returning();

  return { decision, candidateId: inserted?.id ?? null };
}
