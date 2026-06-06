"use client";

import { useMemo, type DragEvent } from "react";
import { IFormBlock, IFormField } from "@betterinternship/core/forms";
import { useFieldTemplateContext } from "@/app/contexts/field-template.ctx";
import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import { useFormEditorPdfViewer } from "@/app/contexts/pdf-viewer.context";
import { blockMatchesFieldIdentity, createUniqueFieldKey } from "@/lib/form-editor-metadata";
import { isPresetRegistryField } from "@/lib/field-library";
import { getPresetFieldIcon, type PresetFieldIconKey } from "@/lib/preset-field-icons";
import type { ValidatorIRv0 } from "@/lib/validator-ir";
import { sanitizeFieldSchemaDefaults, type FieldSchemaDefaults } from "@/lib/field-schema-defaults";
import { resolveSystemPresetTemplates } from "@/lib/system-preset-resolver";
import {
  SIGNATURE_PRINTED_NAME_TEMPLATE,
  type CompositeTemplateKey,
} from "@/lib/composite-field-templates";
import {
  createSignaturePrintedNameBlocks,
  resolveSignaturePrintedNameDimensions,
} from "@/lib/composite-block-factory";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";

type PaletteSource = "default" | "custom";

type PaletteField = {
  id: string;
  name: string;
  label: string;
  type: "text" | "signature" | "image";
  source: "auto" | "prefill" | "derived" | "manual";
  shared: boolean;
  tag: string;
  preset: string;
  prefiller: string;
  tooltip_label: string;
  validator: string;
  validator_ir: ValidatorIRv0 | null;
  field_schema_defaults?: FieldSchemaDefaults;
  iconKey?: string;
  paletteSource: PaletteSource;
  composite_template?: CompositeTemplateKey;
  auto_date_mode?: "default" | "party";
};

type DragFieldPayload = Omit<PaletteField, "iconKey" | "paletteSource"> & {
  __palette_source: PaletteSource;
};

const normalizeSearch = (value: string) => value.trim().toLowerCase();

const matchesSearch = (field: Pick<PaletteField, "name" | "label">, query: string) => {
  if (!query) return true;
  return field.name.toLowerCase().includes(query) || field.label.toLowerCase().includes(query);
};

const BASE_TYPE_ICON_MAP: Partial<Record<ValidatorIRv0["baseType"], PresetFieldIconKey>> = {
  text: "shortText",
  textarea: "longText",
  number: "number",
  date: "date",
  time: "time",
  enum: "dropdown",
  array: "multiselect",
  checkbox: "multiselect",
  signature: "signature",
  image: "signature",
};

/**
 * Left-side field palette for the form editor.
 * - Default fields are resolved DB-first from system presets, with package fallback.
 * - Custom fields come from DB registry.
 */
export function BlocksPanel() {
  const { formMetadata } = useFormEditorMetadata();
  const { registry } = useFieldTemplateContext();
  const {
    blocks,
    selectedPartyId,
    handleBlockCreate,
    handleBlocksCreate,
    searchQuery,
    setSearchQuery,
  } = useEditorSelection();
  const { visiblePage } = useFormEditorPdfViewer();
  const allowClickToAdd = false;
  const signingParties = formMetadata?.signing_parties || [];

  const defaultFields = useMemo<PaletteField[]>(() => {
    const presets = resolveSystemPresetTemplates(registry as any[]);
    const signaturePreset = presets.find((preset) => preset.name === "signature");
    const mappedPresets = presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      label: preset.label || preset.name,
      type: preset.type || "text",
      source: (preset.source as PaletteField["source"]) || "manual",
      shared: typeof preset.shared === "boolean" ? preset.shared : true,
      tag: preset.tag || "preset",
      preset: preset.preset || "default",
      prefiller: preset.prefiller || "",
      tooltip_label: preset.tooltip_label || "",
      validator: preset.validator || "",
      validator_ir: preset.validator_ir || null,
      field_schema_defaults: sanitizeFieldSchemaDefaults(preset.field_schema_defaults),
      iconKey: preset.iconKey,
      paletteSource: "default" as const,
    }));
    const autoCurrentDatePreset = mappedPresets.find(
      (preset) => preset.name === "auto.current-date"
    );
    const mappedPresetsWithoutAutoCurrentDate = mappedPresets.filter(
      (preset) => preset.name !== "auto.current-date"
    );
    const autoCurrentDateVariants = autoCurrentDatePreset
      ? [
          {
            ...autoCurrentDatePreset,
            id: `${autoCurrentDatePreset.id}-default`,
            label: `${autoCurrentDatePreset.label} (Default)`,
            auto_date_mode: "default" as const,
          },
          {
            ...autoCurrentDatePreset,
            id: `${autoCurrentDatePreset.id}-party`,
            label: `${autoCurrentDatePreset.label} (Recipient)`,
            auto_date_mode: "party" as const,
          },
        ]
      : [];

    const compositeField: PaletteField = {
      id: SIGNATURE_PRINTED_NAME_TEMPLATE.id,
      name: SIGNATURE_PRINTED_NAME_TEMPLATE.name,
      label: SIGNATURE_PRINTED_NAME_TEMPLATE.label,
      type: "signature",
      source: (signaturePreset?.source as PaletteField["source"]) || "manual",
      shared: signaturePreset?.shared ?? true,
      tag: "preset",
      preset: "system",
      prefiller: "",
      tooltip_label: "",
      validator: signaturePreset?.validator || "",
      validator_ir: signaturePreset?.validator_ir || null,
      field_schema_defaults: sanitizeFieldSchemaDefaults(signaturePreset?.field_schema_defaults),
      iconKey: "signature",
      paletteSource: "default",
      composite_template: SIGNATURE_PRINTED_NAME_TEMPLATE.key,
    };

    return [...mappedPresetsWithoutAutoCurrentDate, ...autoCurrentDateVariants, compositeField];
  }, [registry]);

  const customFields = useMemo<PaletteField[]>(() => {
    return registry
      .filter((field) => !isPresetRegistryField(field))
      .flatMap((field) => {
        const mapped: PaletteField = {
          id: field.id,
          name: field.name || field.id,
          label: field.label || field.name || field.id,
          type: (field.type as PaletteField["type"]) || "text",
          source: (field.source as PaletteField["source"]) || "manual",
          shared: typeof field.shared === "boolean" ? field.shared : true,
          tag: field.tag || "Custom Fields",
          preset: field.preset || "default",
          prefiller: field.prefiller || "",
          tooltip_label: field.tooltip_label || "",
          validator: field.validator || "",
          validator_ir: (field as { validator_ir?: ValidatorIRv0 | null }).validator_ir ?? null,
          field_schema_defaults: sanitizeFieldSchemaDefaults(
            (field as { field_schema_defaults?: unknown }).field_schema_defaults
          ),
          paletteSource: "custom" as const,
        };

        if (mapped.name === "auto.current-date") {
          return [
            {
              ...mapped,
              id: `${mapped.id}-default`,
              label: `${mapped.label} (Default)`,
              auto_date_mode: "default" as const,
            },
            {
              ...mapped,
              id: `${mapped.id}-party`,
              label: `${mapped.label} (Recipient)`,
              auto_date_mode: "party" as const,
            },
          ];
        }

        return [mapped];
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [registry]);

  const searchQueryNormalized = useMemo(() => normalizeSearch(searchQuery), [searchQuery]);

  const filteredDefaultFields = useMemo(
    () => defaultFields.filter((field) => matchesSearch(field, searchQueryNormalized)),
    [defaultFields, searchQueryNormalized]
  );

  const filteredCustomFields = useMemo(
    () => customFields.filter((field) => matchesSearch(field, searchQueryNormalized)),
    [customFields, searchQueryNormalized]
  );

  const handleDragStart = (e: DragEvent, field: PaletteField) => {
    const payload: DragFieldPayload = {
      id: field.id,
      name: field.name,
      label: field.label,
      type: field.type,
      source: field.source,
      shared: field.shared,
      tag: field.tag,
      preset: field.preset,
      prefiller: field.prefiller,
      tooltip_label: field.tooltip_label,
      validator: field.validator,
      validator_ir: field.validator_ir,
      field_schema_defaults: field.field_schema_defaults,
      composite_template: field.composite_template,
      auto_date_mode: field.auto_date_mode,
      __palette_source: field.paletteSource,
    };

    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("field", JSON.stringify(payload));
  };

  const handleFieldAdd = (field: PaletteField) => {
    const partyId = selectedPartyId || signingParties[0]?._id;
    if (!partyId) return;

    const defaults = field.field_schema_defaults;
    const isSignaturePrintedNameComposite =
      field.composite_template === SIGNATURE_PRINTED_NAME_TEMPLATE.key;
    const presets = isSignaturePrintedNameComposite
      ? resolveSystemPresetTemplates(registry as any[])
      : [];
    const signaturePreset = isSignaturePrintedNameComposite
      ? presets.find((preset) => preset.name === "signature")
      : undefined;
    const shortTextPreset = isSignaturePrintedNameComposite
      ? presets.find((preset) => preset.name === "short_text")
      : undefined;
    const compositeDimensions = isSignaturePrintedNameComposite
      ? resolveSignaturePrintedNameDimensions({ signaturePreset, shortTextPreset })
      : null;
    const defaultFieldHeightByType = field.type === "signature" ? 25 : 12;
    const fieldWidth = compositeDimensions?.signatureWidth ?? defaults?.w ?? 100;
    const fieldHeight =
      compositeDimensions?.signatureHeight ?? defaults?.h ?? defaultFieldHeightByType;
    const printedNameWidth = compositeDimensions?.printedNameWidth ?? fieldWidth;
    const printedNameHeight = compositeDimensions?.printedNameHeight ?? 12;
    const printedNameGap =
      compositeDimensions?.gap ?? SIGNATURE_PRINTED_NAME_TEMPLATE.printedName.gap;
    const totalCompositeHeight = compositeDimensions?.totalHeight ?? fieldHeight;
    const page = Math.max(1, visiblePage || 1);
    const pageMaxX = 560;
    const pageMaxY = 760;
    const marginX = 40;
    const marginY = 48;
    const gapX = 16;
    const gapY = 12;
    const rowStep = (isSignaturePrintedNameComposite ? totalCompositeHeight : fieldHeight) + gapY;
    const colStep = fieldWidth + gapX;

    // Use current page occupancy to place new fields in the next open slot.
    const pageFieldBlocks = blocks.filter(
      (block) =>
        block.block_type === "form_field" &&
        block.field_schema?.page === page &&
        typeof block.field_schema?.x === "number" &&
        typeof block.field_schema?.y === "number" &&
        typeof block.field_schema?.w === "number" &&
        typeof block.field_schema?.h === "number"
    );

    const overlapsExistingRect = (x: number, y: number, width: number, height: number) =>
      pageFieldBlocks.some((block) => {
        const bx = block.field_schema!.x;
        const by = block.field_schema!.y;
        const bw = block.field_schema!.w;
        const bh = block.field_schema!.h;
        const pad = 6;
        return !(
          x + width + pad <= bx ||
          x >= bx + bw + pad ||
          y + height + pad <= by ||
          y >= by + bh + pad
        );
      });

    let nextX = marginX;
    let nextY = marginY;
    let foundSpot = false;

    for (
      let y = marginY;
      y <= pageMaxY - (isSignaturePrintedNameComposite ? totalCompositeHeight : fieldHeight);
      y += rowStep
    ) {
      for (let x = marginX; x <= pageMaxX - fieldWidth; x += colStep) {
        const overlapsSignature = overlapsExistingRect(x, y, fieldWidth, fieldHeight);
        const overlapsPrintedName =
          isSignaturePrintedNameComposite &&
          overlapsExistingRect(
            x,
            y + fieldHeight + printedNameGap,
            printedNameWidth,
            printedNameHeight
          );

        if (!overlapsSignature && !overlapsPrintedName) {
          nextX = x;
          nextY = y;
          foundSpot = true;
          break;
        }
      }
      if (foundSpot) break;
    }

    if (!foundSpot && pageFieldBlocks.length > 0) {
      const last = [...pageFieldBlocks].sort(
        (a, b) => a.field_schema!.y - b.field_schema!.y || a.field_schema!.x - b.field_schema!.x
      )[pageFieldBlocks.length - 1];
      nextX = Math.min(pageMaxX - fieldWidth, Math.max(marginX, last.field_schema!.x));
      nextY = Math.min(
        pageMaxY - (isSignaturePrintedNameComposite ? totalCompositeHeight : fieldHeight),
        last.field_schema!.y + rowStep
      );
    }

    if (isSignaturePrintedNameComposite) {
      const pairBlocks = createSignaturePrintedNameBlocks({
        partyId,
        page,
        x: nextX,
        y: nextY,
        signaturePreset,
        shortTextPreset,
      });
      handleBlocksCreate(pairBlocks);
      return;
    }

    const baseFieldKey = field.name || field.id;
    const presetTag = (field.preset || "").trim();
    const fieldKey =
      baseFieldKey === "auto.current-date"
        ? field.auto_date_mode === "party" && partyId
          ? `auto.current-date:${partyId}`
          : "auto.current-date:default"
        : field.paletteSource === "default"
          ? createUniqueFieldKey(baseFieldKey)
          : presetTag
            ? `${baseFieldKey}:${presetTag}`
            : baseFieldKey;

    const existingForField = blocks.find((block) =>
      blockMatchesFieldIdentity(block, {
        fieldName: fieldKey,
        partyId,
        blockType: "form_field",
      })
    );

    const baseSchema = existingForField?.field_schema;

    const newBlock: IFormBlock = {
      _id: `block-${field.id}-${Date.now()}`,
      block_type: "form_field",
      signing_party_id: partyId,
      order: blocks.length,
      field_schema: {
        field: fieldKey,
        type: baseSchema?.type || field.type || "text",
        page,
        x: nextX,
        y: nextY,
        w: baseSchema?.w ?? defaults?.w ?? fieldWidth,
        h: baseSchema?.h ?? defaults?.h ?? fieldHeight,
        align_h: baseSchema?.align_h ?? defaults?.align_h ?? "center",
        align_v: baseSchema?.align_v ?? defaults?.align_v ?? "bottom",
        label: baseSchema?.label || field.label || field.name || field.id,
        tooltip_label: baseSchema?.tooltip_label || field.tooltip_label || "",
        shared:
          typeof baseSchema?.shared === "boolean" ? baseSchema.shared : (field.shared ?? true),
        source: baseSchema?.source || field.source || "manual",
        prefiller: baseSchema?.prefiller ?? field.prefiller,
        validator: baseSchema?.validator ?? field.validator,
        validator_ir:
          (baseSchema as { validator_ir?: ValidatorIRv0 | null } | undefined)?.validator_ir ??
          field.validator_ir,
        size: baseSchema?.size ?? defaults?.size,
        wrap: baseSchema?.wrap ?? defaults?.wrap ?? true,
        font: baseSchema?.font ?? defaults?.font,
      } as IFormField,
    };

    handleBlockCreate(newBlock);
  };

  const hasDefaultResults = filteredDefaultFields.length > 0;
  const hasCustomResults = filteredCustomFields.length > 0;
  const hasAnyResults = hasDefaultResults || hasCustomResults;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b p-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-2 left-2 z-50 h-5 w-5 text-slate-500" />
          <Input
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-auto p-3">
        {!hasAnyResults ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">No fields match this search.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-4 gap-2">
              {filteredDefaultFields.map((field) => {
                const Icon = getPresetFieldIcon(field.iconKey, field.name);
                return (
                  <button
                    key={field.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, field)}
                    onClick={(e) => {
                      if (!allowClickToAdd) {
                        e.preventDefault();
                        return;
                      }
                      handleFieldAdd(field);
                    }}
                    className="hover:bg-primary/5 flex cursor-move flex-col items-center gap-1 rounded-[0.33em] p-1.5 transition-colors"
                    type="button"
                    title={field.label}
                  >
                    <Icon className="h-5 w-5 text-slate-500" />
                    <span className="line-clamp-2 text-center text-[10px] leading-tight text-slate-600">
                      {field.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="py-2">
              <div className="border-t border-slate-200" />
            </div>

            {filteredCustomFields.map((field) => {
              const iconKey = field.validator_ir
                ? BASE_TYPE_ICON_MAP[field.validator_ir.baseType]
                : undefined;
              const Icon = getPresetFieldIcon(iconKey);
              return (
                <button
                  key={field.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, field)}
                  onClick={(e) => {
                    if (!allowClickToAdd) {
                      e.preventDefault();
                      return;
                    }
                    handleFieldAdd(field);
                  }}
                  className="hover:bg-primary/5 hover:text-primary flex w-full cursor-move items-center gap-2 rounded-[0.33em] border border-transparent px-2 py-1.5 text-left transition-colors"
                  type="button"
                  title="Drag to add"
                >
                  <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                  <span className="text-sm text-slate-800">{field.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
