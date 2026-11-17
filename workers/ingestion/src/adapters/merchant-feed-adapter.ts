import type { DataSourceAdapter } from "./adapter.interface.js";

export class MerchantFeedAdapter implements DataSourceAdapter {
  readonly sourceType = "merchant_feed" as const;

  async fetchRecords(
    configuration: Record<string, unknown>,
    payload?: string | Array<Record<string, unknown>>,
  ): Promise<Array<Record<string, unknown>>> {
    if (Array.isArray(payload)) {
      return payload;
    }
    if (typeof payload === "string" && payload.trim().length > 0) {
      const parsed = JSON.parse(payload) as unknown;
      if (Array.isArray(parsed)) {
        return parsed as Array<Record<string, unknown>>;
      }
    }
    if (Array.isArray(configuration.mockRecords)) {
      return configuration.mockRecords as Array<Record<string, unknown>>;
    }
    return [];
  }
}
