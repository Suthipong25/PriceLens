import {
  calculateOfferTotalPrice,
  normalizeBarcode,
  normalizeIdentifier,
  normalizeProductAttributes,
} from "@pricelens/business";
import { slugify, type ProductAttributes } from "@pricelens/shared";
import type { ValidatedSourceRecord } from "@pricelens/validation";

export interface NormalizedSourceRecord extends ValidatedSourceRecord {
  merchantSlugNormalized: string;
  normalizedAttributes: ProductAttributes;
  calculatedPrice: {
    price: string;
    shippingCost: string | null;
    shippingKnown: boolean;
    totalPrice: string | null;
    currency: string;
  };
  normalizedIdentifiers: {
    gtin: string | null;
    ean: string | null;
    upc: string | null;
    mpn: string | null;
    sku: string | null;
  };
}

export function normalizeSourceRecord(
  record: ValidatedSourceRecord,
): NormalizedSourceRecord {
  const merchantSlugNormalized = slugify(
    record.merchantSlug ?? record.merchantName,
  );
  const normalizedAttributes = normalizeProductAttributes(
    record.title,
    record.attributes ?? {},
    record.condition,
  );
  const calculatedPrice = calculateOfferTotalPrice(
    record.price,
    record.shippingCost,
    record.currency,
  );

  return {
    ...record,
    merchantSlugNormalized,
    normalizedAttributes,
    calculatedPrice,
    normalizedIdentifiers: {
      gtin: normalizeBarcode(record.gtin),
      ean: normalizeBarcode(record.ean),
      upc: normalizeBarcode(record.upc),
      mpn: normalizeIdentifier(record.mpn),
      sku: normalizeIdentifier(record.sku),
    },
  };
}
