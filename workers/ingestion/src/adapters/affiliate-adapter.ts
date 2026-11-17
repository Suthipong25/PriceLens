import type { DataSourceAdapter } from "./adapter.interface.js";

export class AffiliateAdapter implements DataSourceAdapter {
  readonly sourceType = "affiliate_api" as const;

  async fetchRecords(
    configuration: Record<string, unknown>,
    payload?: string | Array<Record<string, unknown>>,
  ): Promise<Array<Record<string, unknown>>> {
    const baseRecords = Array.isArray(payload)
      ? payload
      : Array.isArray(configuration.mockRecords)
        ? (configuration.mockRecords as Array<Record<string, unknown>>)
        : [];

    const networkTag =
      typeof configuration.affiliateNetwork === "string"
        ? configuration.affiliateNetwork
        : "pricelens_aff";

    return baseRecords.map((rec) => {
      if (rec.affiliateUrl) return rec;
      const productUrl = typeof rec.productUrl === "string" ? rec.productUrl : null;
      if (!productUrl) return rec;

      try {
        const url = new URL(productUrl);
        url.searchParams.set("utm_source", "pricelens");
        url.searchParams.set("aff_network", networkTag);
        return {
          ...rec,
          affiliateUrl: url.toString(),
        };
      } catch {
        return rec;
      }
    });
  }
}
