import { IFormMetadata } from "@betterinternship/core/forms";

export function applySaveRules(metadata: IFormMetadata): IFormMetadata {
  const blocks = metadata.schema.blocks
    // Remove phantom fields
    .filter((b) => b.block_type !== "form_phantom_field")
    .map((b) => {
      // and remove prefiller for student.program
      if (b.field_schema?.prefiller?.includes("student.program")) {
        return { ...b, field_schema: { ...b.field_schema, prefiller: "" } };
      }
      return b;
    });

  return { ...metadata, schema: { ...metadata.schema, blocks } };
}
