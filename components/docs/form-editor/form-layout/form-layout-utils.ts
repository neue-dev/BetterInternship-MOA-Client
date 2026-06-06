import type { IFormBlock } from "@betterinternship/core/forms";

/**
 * Returns blocks that belong to a specific signing party, plus blocks with no
 * party assignment (shared/global blocks visible to all parties).
 */
export function filterBlocksByParty(blocks: IFormBlock[], partyId: string): IFormBlock[] {
  return blocks.filter((b) => b.signing_party_id === partyId || !b.signing_party_id);
}

type FieldWithPrefiller = {
  field: string;
  source?: string;
  prefiller?: ((params: { signatory: Record<string, unknown> }) => unknown) | null;
};

/**
 * Runs each field's prefiller function and returns a flat record of field → value
 * strings. Fields with source "prefill" are always skipped (server-side filled).
 * Pass `skipExisting` to avoid overwriting fields that already have a value in
 * `existing` (useful when re-running on party switch to preserve manual edits).
 */
export function extractPrefillValues(
  fields: FieldWithPrefiller[],
  options: { existing?: Record<string, string>; skipExisting?: boolean; trim?: boolean } = {}
): Record<string, string> {
  const { existing = {}, skipExisting = false, trim: doTrim = false } = options;
  const result: Record<string, string> = {};
  for (const field of fields) {
    if (field.source === "prefill") continue;
    if (typeof field.prefiller !== "function") continue;
    if (skipExisting && existing[field.field] !== undefined && existing[field.field] !== "") continue;
    try {
      const raw = field.prefiller({ signatory: {} });
      if (raw === undefined || raw === null) continue;
      const str = typeof raw === "string" ? raw : String(raw);
      result[field.field] = doTrim ? str.trim() : str;
    } catch {
      // Ignore prefiller execution errors in preview.
    }
  }
  return result;
}
