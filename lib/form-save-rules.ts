import { IFormMetadata } from "@betterinternship/core/forms";
import { persistedIRToZod } from "./validator-ir";

// Temporary migration: older required time fields saved the IR rule but compiled
// it as z.string().describe("time"), which accepts an empty string.
const hasRequiredTimeRule = (validatorIr: unknown) => {
  if (!validatorIr || typeof validatorIr !== "object") return false;
  const { baseType, rules } = validatorIr as {
    baseType?: unknown;
    rules?: unknown;
  };
  return (
    baseType === "time" &&
    Array.isArray(rules) &&
    rules.some(
      (rule) => rule && typeof rule === "object" && (rule as { kind?: unknown }).kind === "required"
    )
  );
};

export function applySaveRules(metadata: IFormMetadata): IFormMetadata {
  const blocks = metadata.schema.blocks
    // Remove phantom fields
    .filter((b) => b.block_type !== "form_phantom_field")
    .map((b) => {
      const field = b.field_schema;
      if (!field) return b;

      // Remove prefiller for student.program fields, since they are now prefilled by the backend.
      const prefiller = field.prefiller?.includes("student.program") ? "" : field.prefiller;
      // Recompile legacy required-time fields so their stored Zod receives the
      // .nonempty(...) rule emitted by persistedIRToZod.
      const validator = hasRequiredTimeRule(field.validator_ir)
        ? persistedIRToZod(field.validator_ir!)
        : field.validator;

      if (prefiller === field.prefiller && validator === field.validator) return b;

      return { ...b, field_schema: { ...field, prefiller, validator } };
    });

  return { ...metadata, schema: { ...metadata.schema, blocks } };
}
