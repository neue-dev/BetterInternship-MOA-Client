import { FieldRegistryEntry } from "@/app/api";
import { IFormBlock, IFormField } from "@betterinternship/core/forms";
import { sanitizeFieldSchemaDefaults, type FieldSchemaDefaults } from "@/lib/field-schema-defaults";
import { resolveSystemPresetTemplates } from "@/lib/system-preset-resolver";
import { type CompositeTemplateKey } from "@/lib/composite-field-templates";
import {
  createSignaturePrintedNameBlocks,
  resolveSignaturePrintedNameDimensions,
} from "@/lib/composite-block-factory";
import type { ValidatorIRv0 } from "@/lib/validator-ir";
import { createUniqueFieldKey } from "./pdf-editor-utils";

export type DraggedFieldPayload = {
  id?: string;
  name: string;
  label?: string;
  type: "text" | "signature" | "image";
  source?: "auto" | "prefill" | "derived" | "manual";
  shared?: boolean;
  tag?: string;
  preset?: string;
  prefiller?: string;
  tooltip_label?: string;
  validator?: string;
  validator_ir?: ValidatorIRv0 | null;
  __palette_source?: "default" | "custom";
  field_schema_defaults?: FieldSchemaDefaults;
  composite_template?: CompositeTemplateKey;
  auto_date_mode?: "default" | "party";
};

export const resolveDroppedFieldKey = (
  field: DraggedFieldPayload,
  selectedPartyId?: string | null
) => {
  const base = field.name || "field";
  if (base === "auto.current-date") {
    return field.auto_date_mode === "party" && selectedPartyId
      ? `auto.current-date:${selectedPartyId}`
      : "auto.current-date:default";
  }
  if (field.__palette_source === "default") {
    return createUniqueFieldKey(base);
  }
  return field.preset ? `${base}:${field.preset}` : base;
};

export const getCompositePresets = (registryRows: FieldRegistryEntry[]) => {
  const presets = resolveSystemPresetTemplates(registryRows);
  return {
    signaturePreset: presets.find((preset) => preset.name === "signature"),
    shortTextPreset: presets.find((preset) => preset.name === "short_text"),
  };
};

type CompositeDimensions = ReturnType<typeof resolveSignaturePrintedNameDimensions>;

/**
 * Builds a single form-field block from a dropped palette field. Coordinate math
 * differs per drop surface (canvas vs. viewer fallback), so callers supply
 * `resolvePosition`, which receives the resolved field dimensions and returns the
 * top-left PDF position.
 */
export const buildDroppedFieldBlock = ({
  draggedField,
  page,
  blocks,
  selectedPartyId,
  resolvePosition,
}: {
  draggedField: DraggedFieldPayload;
  page: number;
  blocks: IFormBlock[];
  selectedPartyId: string | null;
  resolvePosition: (dimensions: { fieldWidth: number; fieldHeight: number }) => {
    x: number;
    y: number;
  };
}): IFormBlock => {
  const uniqueId = Math.random().toString(36).substr(2, 9);
  const fieldKey = resolveDroppedFieldKey(draggedField, selectedPartyId);
  const existingForField = blocks.find(
    (block) =>
      block.block_type === "form_field" &&
      block.signing_party_id === (selectedPartyId || "") &&
      block.field_schema?.field === fieldKey
  );
  const baseSchema = existingForField?.field_schema;
  const defaults = sanitizeFieldSchemaDefaults(draggedField.field_schema_defaults);
  const defaultFieldHeightByType = draggedField.type === "signature" ? 25 : 12;
  const fieldWidth = defaults?.w ?? 100;
  const fieldHeight = defaults?.h ?? defaultFieldHeightByType;

  const { x, y } = resolvePosition({ fieldWidth, fieldHeight });

  const newBlock: IFormBlock = {
    _id: uniqueId,
    block_type: "form_field",
    signing_party_id: selectedPartyId || "",
    order: 0,
    field_schema: {
      field: fieldKey,
      label: baseSchema?.label || draggedField.label || "New Field",
      tooltip_label: baseSchema?.tooltip_label || draggedField.tooltip_label || "",
      type: baseSchema?.type || draggedField.type,
      page,
      x,
      y,
      w: baseSchema?.w ?? fieldWidth,
      h: baseSchema?.h ?? fieldHeight,
      align_h: baseSchema?.align_h ?? defaults?.align_h ?? "center",
      align_v: baseSchema?.align_v ?? defaults?.align_v ?? "bottom",
      shared:
        typeof baseSchema?.shared === "boolean"
          ? baseSchema.shared
          : (draggedField.shared ?? true),
      source: (baseSchema?.source || draggedField.source || "manual") as IFormField["source"],
      ...(baseSchema?.prefiller
        ? { prefiller: baseSchema.prefiller }
        : draggedField.prefiller
          ? { prefiller: draggedField.prefiller }
          : {}),
      ...(baseSchema?.validator
        ? { validator: baseSchema.validator }
        : draggedField.validator
          ? { validator: draggedField.validator }
          : {}),
      ...(baseSchema?.validator_ir
        ? { validator_ir: baseSchema.validator_ir }
        : draggedField.validator_ir
          ? { validator_ir: draggedField.validator_ir }
          : {}),
      ...(baseSchema?.size
        ? { size: baseSchema.size }
        : defaults?.size
          ? { size: defaults.size }
          : {}),
      ...(typeof baseSchema?.wrap === "boolean"
        ? { wrap: baseSchema.wrap }
        : typeof defaults?.wrap === "boolean"
          ? { wrap: defaults.wrap }
          : { wrap: true }),
      ...(baseSchema?.font
        ? { font: baseSchema.font }
        : defaults?.font
          ? { font: defaults.font }
          : {}),
    },
  };

  // Inject radio group metadata when dropping a radio option preset
  if (draggedField.validator_ir?.baseType === "radio" && newBlock.field_schema) {
    const radioGroupId = `rg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    newBlock.field_schema = {
      ...newBlock.field_schema,
      radio_group_id: radioGroupId,
      radio_option_label: "Option 1",
    };
  }

  return newBlock;
};

/**
 * Builds the signature + printed-name block pair from a composite-template drop.
 * Callers supply `resolvePosition`, which receives the resolved composite
 * dimensions and returns the clamped top-left PDF position.
 */
export const buildCompositeDropBlocks = ({
  registry,
  page,
  selectedPartyId,
  resolvePosition,
}: {
  registry: FieldRegistryEntry[];
  page: number;
  selectedPartyId: string | null;
  resolvePosition: (dimensions: CompositeDimensions) => { x: number; y: number };
}): IFormBlock[] => {
  const { signaturePreset, shortTextPreset } = getCompositePresets(registry);
  const dimensions = resolveSignaturePrintedNameDimensions({
    signaturePreset,
    shortTextPreset,
  });

  const { x, y } = resolvePosition(dimensions);

  return createSignaturePrintedNameBlocks({
    partyId: selectedPartyId || "",
    page,
    x,
    y,
    signaturePreset,
    shortTextPreset,
  });
};
