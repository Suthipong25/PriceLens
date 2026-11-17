import type { DataSourceAdapter } from "./adapter.interface.js";

/**
 * Parses RFC 4180 CSV content into raw objects without external dependencies.
 */
export function parseCsvToObjects(csvText: string): Array<Record<string, unknown>> {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i]!;
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if (ch === "\r" && next === "\n") {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
      i++;
    } else if (ch === "\n") {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  const headers = rows[0]!.map((h) => h.trim());
  const records: Array<Record<string, unknown>> = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const obj: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      const cell = row[c] ?? "";
      obj[key] = cell === "" ? null : cell;
    }
    records.push(obj);
  }

  return records;
}

export class CsvAdapter implements DataSourceAdapter {
  readonly sourceType = "csv" as const;

  async fetchRecords(
    _configuration: Record<string, unknown>,
    payload?: string | Array<Record<string, unknown>>,
  ): Promise<Array<Record<string, unknown>>> {
    if (Array.isArray(payload)) {
      return payload;
    }
    if (typeof payload === "string" && payload.trim().length > 0) {
      return parseCsvToObjects(payload);
    }
    return [];
  }
}
