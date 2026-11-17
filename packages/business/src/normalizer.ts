import type { ProductAttributes, ProductCondition } from "@pricelens/shared";

const PROMO_NOISE_PATTERNS = [
  /\[demo data\]/gi,
  /ประกันศูนย์ไทย/g,
  /ประกันศูนย์/g,
  /ส่งฟรี/g,
  /ของแท้\s*100%/g,
  /ออกใบกำกับภาษีได้/g,
  /ผ่อน\s*0%/g,
  /สมาร์ทโฟน/g,
  /หูฟังไร้สายตัดเสียงรบกวน/g,
];

/**
 * Normalizes a barcode, GTIN, EAN, UPC, or MPN for exact deterministic comparison.
 */
export function normalizeIdentifier(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, "");
  return cleaned.length >= 2 ? cleaned : null;
}

/**
 * Normalizes a numeric barcode (GTIN/EAN/UPC) by stripping non-digits and left-padding EAN-13 / GTIN-14 consistently.
 */
export function normalizeBarcode(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D+/g, "");
  if (digits.length < 8 || digits.length > 14) return null;
  return digits.padStart(14, "0");
}

/**
 * Normalizes a product title into clean tokens for comparison.
 */
export function normalizeProductTitle(title: string): string {
  let text = title.toLowerCase();
  for (const pattern of PROMO_NOISE_PATTERNS) {
    text = text.replace(pattern, " ");
  }
  return text
    .replace(/[()[\]{},/\\|+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeTitle(title: string): Set<string> {
  const normalized = normalizeProductTitle(title);
  const tokens = normalized
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return new Set(tokens);
}

export function calculateTitleSimilarity(titleA: string, titleB: string): number {
  const setA = tokenizeTitle(titleA);
  const setB = tokenizeTitle(titleB);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Standardizes variant attributes (storage_capacity, ram, color, size, condition)
 * from explicit attributes and/or title tokens so variant comparisons are deterministic.
 */
export function normalizeProductAttributes(
  title: string,
  explicit: ProductAttributes = {},
  conditionInput?: ProductCondition,
): ProductAttributes {
  const normalized: ProductAttributes = { ...explicit };

  // Normalize storage capacity (e.g., 128GB, 256GB, 512GB, 1TB, 2TB)
  const rawStorage =
    explicit.storage_capacity ??
    title.match(/\b(64|128|256|512)\s*gb\b/i)?.[0] ??
    title.match(/\b([124])\s*tb\b/i)?.[0];
  if (rawStorage) {
    normalized.storage_capacity = String(rawStorage)
      .toUpperCase()
      .replace(/\s+/g, "");
  }

  // Normalize RAM (e.g., 8GB, 12GB, 16GB, 24GB, 32GB, 64GB)
  const rawRam =
    explicit.ram ??
    title.match(/\b(4|6|8|12|16|18|24|32|36|48|64)\s*gb(?:\s*ram)?\b/i)?.[0];
  if (rawRam && (!normalized.storage_capacity || !rawRam.toUpperCase().includes(normalized.storage_capacity))) {
    normalized.ram = String(rawRam)
      .toUpperCase()
      .replace(/RAM/gi, "")
      .replace(/\s+/g, "");
  }

  // Handle "12GB/256GB" or "16/512GB" notation in Thai titles
  const slashCombo = title.match(/\b(8|12|16|24|32)\s*(?:gb)?\s*\/\s*(128|256|512|1024)\s*gb\b/i);
  if (slashCombo) {
    if (!explicit.ram) normalized.ram = `${slashCombo[1]}GB`;
    if (!explicit.storage_capacity) normalized.storage_capacity = `${slashCombo[2]}GB`;
  }

  if (explicit.color) {
    normalized.color = String(explicit.color).trim();
  }

  if (explicit.size) {
    normalized.size = String(explicit.size).trim().toLowerCase();
  }

  if (conditionInput || explicit.condition) {
    normalized.condition = (conditionInput ?? explicit.condition) as ProductCondition;
  }

  return normalized;
}
