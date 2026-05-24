import { IFormBlock, SOURCES } from "@betterinternship/core/forms";

type SchemaLike = Record<string, any>;

const SOURCE_SET = new Set<string>(SOURCES as string[]);

function normalizeSource(source: unknown): string {
  if (typeof source === "string" && SOURCE_SET.has(source)) return source;
  return "manual";
}

function normalizeSchema<T extends SchemaLike>(schema: T | undefined): T | undefined {
  if (!schema) return schema;

  const align_h = schema.align_h ?? schema.horizontal_alignment;
  const align_v = schema.align_v ?? schema.vertical_alignment;
  const size = schema.size ?? schema.font_size;
  const wrap = schema.wrap ?? schema.text_wrapping ?? true;

  const normalized: SchemaLike = {
    field: schema.field || "",
    type: schema.type || "text",
    x: typeof schema.x === "number" ? schema.x : 0,
    y: typeof schema.y === "number" ? schema.y : 0,
    w: typeof schema.w === "number" ? schema.w : 100,
    h: typeof schema.h === "number" ? schema.h : 12,
    page: typeof schema.page === "number" ? schema.page : 1,
    align_h: align_h || "center",
    align_v: align_v || "middle",
    // Preserve explicit empty label strings; only fall back when label is null/undefined.
    label: schema.label ?? schema.field ?? "",
    tooltip_label: schema.tooltip_label || "",
    shared: typeof schema.shared === "boolean" ? schema.shared : true,
    source: normalizeSource(schema.source),
    prefiller: schema.prefiller,
    validator: schema.validator,
    validator_ir: schema.validator_ir ?? null,
    size,
    wrap,
    font: schema.font,
    radio_group_id: schema.radio_group_id,
    radio_option_label: schema.radio_option_label,
  };

  delete normalized.horizontal_alignment;
  delete normalized.vertical_alignment;
  delete normalized.font_size;
  delete normalized.text_wrapping;

  return normalized as T;
}

function normalizePhantomSchema<T extends SchemaLike>(schema: T | undefined): T | undefined {
  if (!schema) return schema;

  const normalized: SchemaLike = {
    field: schema.field || "",
    type: schema.type || "text",
    // Preserve explicit empty label strings; only fall back when label is null/undefined.
    label: schema.label ?? schema.field ?? "",
    tooltip_label: schema.tooltip_label || "",
    shared: typeof schema.shared === "boolean" ? schema.shared : true,
    source: normalizeSource(schema.source),
    prefiller: schema.prefiller,
    validator: schema.validator,
    validator_ir: schema.validator_ir ?? null,
  };

  return normalized as T;
}

export function normalizeBlockForSave(block: IFormBlock): IFormBlock {
  const normalized: IFormBlock = {
    ...block,
    field_schema: normalizeSchema(block.field_schema),
    phantom_field_schema: normalizePhantomSchema(block.phantom_field_schema),
  };

  if (normalized.block_type === "form_field") {
    delete normalized.phantom_field_schema;
  }

  if (normalized.block_type === "form_phantom_field") {
    delete normalized.field_schema;
  }

  return normalized;
}

export function normalizeBlocksForSave(blocks: IFormBlock[]): IFormBlock[] {
  return blocks.map(normalizeBlockForSave);
}
