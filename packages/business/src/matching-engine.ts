import type {
  IdentifierType,
  ProductAttributes,
  ProductCondition,
} from "@pricelens/shared";
import {
  calculateTitleSimilarity,
  normalizeBarcode,
  normalizeIdentifier,
  normalizeProductAttributes,
} from "./normalizer.js";

export interface CanonicalProductCandidate {
  id: string;
  name: string;
  brandName: string;
  model: string | null;
  attributes: ProductAttributes;
  identifiers: Array<{
    type: IdentifierType;
    value: string;
  }>;
}

export interface IncomingProductOfferInput {
  externalProductId: string;
  title: string;
  brandName?: string | null;
  model?: string | null;
  gtin?: string | null;
  ean?: string | null;
  upc?: string | null;
  mpn?: string | null;
  sku?: string | null;
  condition?: ProductCondition;
  attributes?: ProductAttributes;
}

export interface ProductMatchDecision {
  decision: "auto_matched" | "needs_review" | "unmatched";
  matchedProductId: string | null;
  confidenceScore: number;
  matchingReasons: string[];
  normalizedAttributes: ProductAttributes;
}

const VARIANT_KEYS: Array<keyof ProductAttributes> = [
  "storage_capacity",
  "ram",
  "color",
  "size",
  "cpu",
  "gpu",
  "condition",
  "variant",
];

function normalizeAttrVal(val: unknown): string | null {
  if (val === undefined || val === null || String(val).trim() === "") {
    return null;
  }
  return String(val).trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Checks whether two attribute sets have any conflicting variant values
 * (e.g., 256GB vs 512GB, Black vs Silver, new vs refurbished) and counts matching attributes.
 */
export function compareVariantAttributes(
  incomingAttrs: ProductAttributes,
  productAttrs: ProductAttributes,
): {
  hasConflict: boolean;
  conflictReasons: string[];
  matchedAttributes: string[];
} {
  const conflictReasons: string[] = [];
  const matchedAttributes: string[] = [];

  for (const key of VARIANT_KEYS) {
    const inVal = normalizeAttrVal(incomingAttrs[key]);
    const prodVal = normalizeAttrVal(productAttrs[key]);
    if (inVal && prodVal) {
      if (inVal !== prodVal) {
        conflictReasons.push(
          `VARIANT_CONFLICT:${String(key)}(${inVal}!=${prodVal})`,
        );
      } else {
        matchedAttributes.push(`VARIANT_MATCH:${String(key)}=${inVal}`);
      }
    }
  }

  return {
    hasConflict: conflictReasons.length > 0,
    conflictReasons,
    matchedAttributes,
  };
}

/**
 * Deterministic Product Matching Engine (Module C).
 *
 * Priority:
 * 1. GTIN / EAN / UPC / Barcode (Confidence 100)
 * 2. Manufacturer Part Number (MPN) (Confidence 95)
 * 3. Brand + Model + Variant Attributes (Confidence 90)
 * 4. Normalized Title + Attribute Comparison (Confidence 50-84 -> NEVER auto-merged; sent to review queue)
 */
export function matchProductDeterministically(
  incoming: IncomingProductOfferInput,
  catalog: CanonicalProductCandidate[],
): ProductMatchDecision {
  const normalizedAttributes = normalizeProductAttributes(
    incoming.title,
    incoming.attributes ?? {},
    incoming.condition ?? "new",
  );

  const incomingBarcodes = [incoming.gtin, incoming.ean, incoming.upc]
    .map((b) => normalizeBarcode(b))
    .filter((b): b is string => b !== null);

  const incomingMpn = normalizeIdentifier(incoming.mpn);
  const incomingModel = normalizeIdentifier(incoming.model);
  const incomingBrand = incoming.brandName?.trim().toLowerCase() ?? null;

  let bestReviewCandidate: {
    productId: string;
    confidenceScore: number;
    reasons: string[];
  } | null = null;

  for (const product of catalog) {
    const productNormalizedAttrs = normalizeProductAttributes(
      product.name,
      product.attributes,
      product.attributes.condition ?? "new",
    );

    const variantCheck = compareVariantAttributes(
      normalizedAttributes,
      productNormalizedAttrs,
    );

    const productBarcodes = product.identifiers
      .filter((id) =>
        ["GTIN", "EAN", "UPC", "BARCODE"].includes(id.type),
      )
      .map((id) => normalizeBarcode(id.value))
      .filter((b): b is string => b !== null);

    // ------------------------------------------------------------------------
    // Priority 1: Exact Barcode / GTIN / EAN / UPC
    // ------------------------------------------------------------------------
    const matchedBarcode = incomingBarcodes.find((b) =>
      productBarcodes.includes(b),
    );
    if (matchedBarcode) {
      if (variantCheck.hasConflict) {
        bestReviewCandidate = {
          productId: product.id,
          confidenceScore: 65,
          reasons: [
            `BARCODE_MATCH:${matchedBarcode}`,
            ...variantCheck.conflictReasons,
            "BARCODE_WITH_VARIANT_CONFLICT_REQUIRES_ADMIN_REVIEW",
          ],
        };
        continue;
      }

      return {
        decision: "auto_matched",
        matchedProductId: product.id,
        confidenceScore: 100,
        matchingReasons: [
          `PRIORITY_1_BARCODE_MATCH:${matchedBarcode}`,
          ...variantCheck.matchedAttributes,
        ],
        normalizedAttributes,
      };
    }

    // Hard veto for Priorities 2–5: Never merge different sizes, colors, models, or capacities
    if (variantCheck.hasConflict) {
      continue;
    }

    const productMpns = product.identifiers
      .filter((id) => id.type === "MPN")
      .map((id) => normalizeIdentifier(id.value))
      .filter((m): m is string => m !== null);
    const productModel = normalizeIdentifier(product.model);

    // If both explicitly specify a model code and they differ, veto
    if (incomingModel && productModel && incomingModel !== productModel) {
      continue;
    }

    const brandMatches =
      incomingBrand !== null
        ? incomingBrand === product.brandName.trim().toLowerCase()
        : incoming.title
            .toLowerCase()
            .includes(product.brandName.trim().toLowerCase());

    // ------------------------------------------------------------------------
    // Priority 2: Exact Manufacturer Part Number (MPN)
    // ------------------------------------------------------------------------
    if (
      incomingMpn &&
      (productMpns.includes(incomingMpn) || productModel === incomingMpn) &&
      brandMatches
    ) {
      return {
        decision: "auto_matched",
        matchedProductId: product.id,
        confidenceScore: 95,
        matchingReasons: [
          `PRIORITY_2_MPN_MATCH:${incomingMpn}`,
          `BRAND_MATCH:${product.brandName}`,
          ...variantCheck.matchedAttributes,
        ],
        normalizedAttributes,
      };
    }

    // ------------------------------------------------------------------------
    // Priority 3: Brand + Exact Model + Variant Attributes
    // ------------------------------------------------------------------------
    if (
      brandMatches &&
      incomingModel &&
      productModel &&
      incomingModel === productModel
    ) {
      if (variantCheck.matchedAttributes.length >= 1) {
        return {
          decision: "auto_matched",
          matchedProductId: product.id,
          confidenceScore: 90,
          matchingReasons: [
            `PRIORITY_3_BRAND_MODEL_MATCH:${product.brandName}/${incomingModel}`,
            ...variantCheck.matchedAttributes,
          ],
          normalizedAttributes,
        };
      }

      const score = 82;
      if (!bestReviewCandidate || score > bestReviewCandidate.confidenceScore) {
        bestReviewCandidate = {
          productId: product.id,
          confidenceScore: score,
          reasons: [
            `BRAND_MODEL_MATCH:${product.brandName}/${incomingModel}`,
            "INSUFFICIENT_VARIANT_ATTRIBUTES_FOR_AUTO_MERGE",
          ],
        };
      }
      continue;
    }

    // ------------------------------------------------------------------------
    // Priority 4 & 5: Normalized Title + Attribute Comparison (Review Queue Only)
    // Rule: Never match products based only on similar names.
    // ------------------------------------------------------------------------
    if (brandMatches) {
      const titleSim = calculateTitleSimilarity(incoming.title, product.name);
      if (titleSim >= 0.45) {
        const attrBonus = Math.min(variantCheck.matchedAttributes.length * 6, 15);
        const computedConfidence = Math.min(
          84,
          Math.round((titleSim * 75 + attrBonus) * 100) / 100,
        );

        if (
          !bestReviewCandidate ||
          computedConfidence > bestReviewCandidate.confidenceScore
        ) {
          bestReviewCandidate = {
            productId: product.id,
            confidenceScore: computedConfidence,
            reasons: [
              `EXACT_BRAND_MATCH:${product.brandName}`,
              `NORMALIZED_TITLE_SIMILARITY:${titleSim.toFixed(2)}`,
              ...variantCheck.matchedAttributes,
              "MISSING_HARD_IDENTIFIER_REQUIRES_ADMIN_REVIEW",
            ],
          };
        }
      }
    }
  }

  if (bestReviewCandidate) {
    return {
      decision: "needs_review",
      matchedProductId: bestReviewCandidate.productId,
      confidenceScore: bestReviewCandidate.confidenceScore,
      matchingReasons: bestReviewCandidate.reasons,
      normalizedAttributes,
    };
  }

  return {
    decision: "unmatched",
    matchedProductId: null,
    confidenceScore: 0,
    matchingReasons: ["NO_MATCHING_PRODUCT_FOUND_IN_CATALOG"],
    normalizedAttributes,
  };
}
