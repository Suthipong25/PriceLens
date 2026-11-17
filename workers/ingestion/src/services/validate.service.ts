import {
  rawSourceRecordSchema,
  type ValidatedSourceRecord,
} from "@pricelens/validation";

export interface ValidationOutcome {
  valid: boolean;
  record?: ValidatedSourceRecord;
  errors?: string[];
}

export function validateSourceRecord(
  raw: Record<string, unknown>,
): ValidationOutcome {
  const parsed = rawSourceRecordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "record"}: ${i.message}`,
      ),
    };
  }
  return {
    valid: true,
    record: parsed.data,
  };
}
