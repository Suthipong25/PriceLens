import { DEFAULT_CURRENCY } from "./constants.js";

const thbFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: DEFAULT_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a numeric or decimal string price in THB.
 * Explicitly returns "ไม่ระบุ" when value is null or undefined.
 */
export function formatPriceTHB(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") {
    return "ไม่ระบุ";
  }
  const numeric = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(numeric)) {
    return "ไม่ระบุ";
  }
  return thbFormatter.format(numeric);
}

/**
 * Distinguishes verified free shipping (0.00) from unknown shipping (null).
 */
export function formatShippingTHB(shippingCost: string | number | null | undefined): string {
  if (shippingCost === null || shippingCost === undefined || shippingCost === "") {
    return "ไม่ระบุค่าจัดส่ง";
  }
  const numeric = typeof shippingCost === "number" ? shippingCost : Number(shippingCost);
  if (!Number.isFinite(numeric)) {
    return "ไม่ระบุค่าจัดส่ง";
  }
  if (numeric === 0) {
    return "ส่งฟรี (฿0.00)";
  }
  return thbFormatter.format(numeric);
}

/**
 * Converts a number or numeric string to a fixed 2-decimal string for PostgreSQL NUMERIC(12, 2).
 */
export function toDecimalString(value: string | number): string {
  const num = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid monetary value: ${String(value)}`);
  }
  return (Math.round(num * 100) / 100).toFixed(2);
}

/**
 * Creates a clean URL slug preserving alphanumeric and Thai characters when needed.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
