export interface DataSourceAdapter {
  readonly sourceType: "csv" | "merchant_feed" | "affiliate_api" | "mock";
  fetchRecords(
    configuration: Record<string, unknown>,
    payload?: string | Array<Record<string, unknown>>,
  ): Promise<Array<Record<string, unknown>>>;
}
