"use client";

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */

import { IFormBlock } from "@betterinternship/core/forms";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { useFieldTemplateContext } from "@/app/contexts/field-template.ctx";
import { FormTextarea, FormInput } from "@/components/docs/forms/EditForm";
import { Button } from "@/components/ui/button";
import {
  BiAlignLeft,
  BiAlignMiddle,
  BiAlignRight,
  BiVerticalBottom,
  BiVerticalCenter,
  BiVerticalTop,
} from "react-icons/bi";
import { DefaultValueSection } from "@/components/docs/form-editor/default-value.bundle";
import type { DefaultValueFieldOption } from "@/components/docs/form-editor/default-value.bundle";
import { parsePrefillerToCompactState, buildManualPrefiller } from "@/lib/default-value-builder";
import { ValidationSection } from "@/components/docs/form-editor/validation.bundle";
import { Switch } from "@/components/ui/switch";
import {
  applyPresetToSchema,
  findPresetByFieldKey,
  isDefaultPresetFieldKey,
} from "@/lib/default-field-preset-utils";
import { resolveSystemPresetTemplates } from "@/lib/system-preset-resolver";
import { RadioGroupFieldEditor } from "./RadioGroupFieldEditor";
import type { RepeatedPdfField } from "@/lib/repeated-pdf-fields";

type FieldOption = DefaultValueFieldOption;

// Resolve the preset that the field's current schema actually reflects, by
// comparing the applied type/validator (not the field key — applying a preset
// rewrites the schema but leaves the key untouched). Prefers an exact match
// including validator_ir, then a looser type+validator match.
function findPresetMatchingSchema(schema: any, presets: any[]): any | null {
  if (!schema) return null;
  const targetType = schema.type;
  const targetValidator = String(schema.validator || "");
  const targetIr = JSON.stringify(schema.validator_ir ?? null);
  let looseMatch: any = null;
  for (const preset of presets) {
    const applied = applyPresetToSchema(schema, preset);
    if (applied.type !== targetType) continue;
    if (String(applied.validator || "") !== targetValidator) continue;
    if (!looseMatch) looseMatch = preset;
    if (JSON.stringify(applied.validator_ir ?? null) === targetIr) return preset;
  }
  return looseMatch;
}

export function RevampedBlockEditor() {
  const { formMetadata, updateBlocks } = useFormEditorMetadata();
  const { registry } = useFieldTemplateContext();
  const {
    selectedBlockId,
    handleBlockUpdate,
    pendingMissingFieldDraft,
    setPendingMissingFieldDraft,
    confirmPendingMissingFieldDraft,
    cancelPendingMissingFieldDraft,
  } = useEditorSelection();

  const block = selectedBlockId
    ? formMetadata?.schema.blocks?.find((b) => b._id === selectedBlockId) || null
    : null;
  const isPendingDraftSelected =
    Boolean(pendingMissingFieldDraft) &&
    selectedBlockId === pendingMissingFieldDraft?._id &&
    !block;
  const activeBlock = block || (isPendingDraftSelected ? pendingMissingFieldDraft : null);

  const [editedBlock, setEditedBlock] = useState<IFormBlock | null>(activeBlock);
  const [presetIdOverride, setPresetIdOverride] = useState<string | null>(null);
  const [positionOpen, setPositionOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);

  type IntegerFieldKey = "size";
  const [integerDrafts, setIntegerDrafts] = useState<Partial<Record<IntegerFieldKey, string>>>({});
  const [placeholderDraft, setPlaceholderDraft] = useState<string | null>(null);
  const INTEGER_FIELD_CONFIG: Record<IntegerFieldKey, { allowNegative: boolean; min?: number }> = {
    size: { allowNegative: false, min: 0 },
  };

  useEffect(() => {
    setEditedBlock(activeBlock);
  }, [activeBlock]);

  useEffect(() => {
    setIntegerDrafts({});
    setPlaceholderDraft(null);
    setPresetIdOverride(null);
    setRepeatOpen(false);
  }, [selectedBlockId]);

  const presetTemplates = useMemo(
    () => resolveSystemPresetTemplates(registry as any[]),
    [registry]
  );
  const presetOptions = useMemo(
    () =>
      presetTemplates.map((preset) => ({
        id: preset.id,
        name:
          (preset.group || "core") === "format"
            ? `Format: ${preset.label || preset.name}`
            : preset.label || preset.name,
      })),
    [presetTemplates]
  );

  const getFieldOptions = (): FieldOption[] => {
    const options: FieldOption[] = [];
    const seen = new Set<string>();
    const partyTitleById = new Map(
      (formMetadata?.signing_parties || []).map((party) => [
        party._id,
        party.signatory_title || party._id,
      ])
    );
    (formMetadata?.schema.blocks || []).forEach((candidate) => {
      const schema = candidate.field_schema || candidate.phantom_field_schema;
      const field = schema?.field;
      if (!field || seen.has(field)) return;
      seen.add(field);
      options.push({
        id: field,
        name: schema?.label || field,
        partyName: partyTitleById.get(candidate.signing_party_id || "") || undefined,
        type: schema?.type,
        validator: schema?.validator || "",
        validator_ir: schema?.validator_ir || null,
      });
    });
    return options.sort((a, b) => a.name.localeCompare(b.name));
  };

  const handleFieldChange = (key: string, value: any) => {
    if (!editedBlock || !formMetadata) return;
    const schema = editedBlock.field_schema || editedBlock.phantom_field_schema;
    if (!schema) return;
    const updated = { ...editedBlock };
    if (editedBlock.field_schema) {
      updated.field_schema = { ...editedBlock.field_schema, [key]: value };
    } else if (editedBlock.phantom_field_schema) {
      updated.phantom_field_schema = { ...editedBlock.phantom_field_schema, [key]: value };
    }
    setEditedBlock(updated);
    if (isPendingDraftSelected) {
      setPendingMissingFieldDraft(updated);
      return;
    }
    if (key === "label") {
      const radioGroupId = (editedBlock.field_schema as any)?.radio_group_id as string | undefined;
      if (radioGroupId) {
        const updatedBlocks = (formMetadata.schema.blocks || []).map((b) => {
          if (
            b.block_type !== "form_field" ||
            (b.field_schema as any)?.radio_group_id !== radioGroupId
          )
            return b;
          return { ...b, field_schema: { ...b.field_schema!, label: value } };
        });
        updateBlocks(updatedBlocks);
        return;
      }
    }
    handleBlockUpdate(updated);
  };

  const handleFieldPatch = (updates: Record<string, any>) => {
    if (!editedBlock || !formMetadata) return;
    const schema = editedBlock.field_schema || editedBlock.phantom_field_schema;
    if (!schema) return;
    const updated = { ...editedBlock };
    if (editedBlock.field_schema) {
      updated.field_schema = { ...editedBlock.field_schema, ...updates };
    } else if (editedBlock.phantom_field_schema) {
      updated.phantom_field_schema = { ...editedBlock.phantom_field_schema, ...updates };
    }
    setEditedBlock(updated);
    if (isPendingDraftSelected) {
      setPendingMissingFieldDraft(updated);
      return;
    }
    handleBlockUpdate(updated);
  };

  const formatIntegerDisplay = (value: unknown, fallback: number) => {
    const raw =
      typeof value === "number" && Number.isFinite(value)
        ? value
        : Number.isFinite(fallback)
          ? fallback
          : 0;
    return String(Math.round(raw));
  };

  const sanitizeIntegerInput = (raw: string, allowNegative: boolean) => {
    const compact = raw.replace(/\s+/gu, "");
    if (!compact) return "";
    const stripped = compact.replace(/[^\d-]/gu, "");
    if (!allowNegative) return stripped.replace(/-/gu, "");
    const isNegative = stripped.startsWith("-");
    const digitsOnly = stripped.replace(/-/gu, "");
    return `${isNegative ? "-" : ""}${digitsOnly}`;
  };

  const commitIntegerValue = (key: IntegerFieldKey, draft: string) => {
    if (!draft || draft === "-") return;
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed)) return;
    const { min } = INTEGER_FIELD_CONFIG[key];
    const nextValue = min !== undefined ? Math.max(min, parsed) : parsed;
    handleFieldChange(key, nextValue);
  };

  const getIntegerInputValue = (key: IntegerFieldKey, value: unknown, fallback: number) => {
    const draft = integerDrafts[key];
    if (draft !== undefined) return draft;
    return formatIntegerDisplay(value, fallback);
  };

  const handleIntegerInputChange = (key: IntegerFieldKey, raw: string) => {
    const nextDraft = sanitizeIntegerInput(raw, INTEGER_FIELD_CONFIG[key].allowNegative);
    setIntegerDrafts((prev) => ({ ...prev, [key]: nextDraft }));
    commitIntegerValue(key, nextDraft);
  };

  const handleIntegerInputBlur = (key: IntegerFieldKey) => {
    const draft = integerDrafts[key];
    if (draft === undefined) return;
    commitIntegerValue(key, draft);
    setIntegerDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  if (!selectedBlockId || !editedBlock) return null;

  const schema = (editedBlock.field_schema || editedBlock.phantom_field_schema) as any;
  const childFieldOptions = getFieldOptions();
  const childSource = (schema?.source as string) || "manual";
  const isChildDerived = childSource === "derived";
  const isChildPrefill = childSource === "prefill";
  const isChildAuto = childSource === "auto";
  const showChildValidation = !isChildDerived && !isChildPrefill && !isChildAuto;
  const showChildPlaceholder = !isChildDerived && !isChildAuto;
  const placeholderDisplay =
    placeholderDraft !== null
      ? placeholderDraft
      : (() => {
          const parsed = parsePrefillerToCompactState((schema?.prefiller || "") as string);
          return parsed.kind === "manual" ? parsed.manualValue : "";
        })();
  const childFieldKey = String(schema?.field || "");
  const repeat = schema?.repeat as RepeatedPdfField | undefined;
  const repeatVisibleCountFields = childFieldOptions.filter(
    (option) => option.id !== childFieldKey
  );
  const isDefaultChildField = isDefaultPresetFieldKey(childFieldKey, presetTemplates);
  const matchedChildPreset = findPresetByFieldKey(childFieldKey, presetTemplates);
  const presetMatchingSchema = findPresetMatchingSchema(schema, presetTemplates);

  return (
    <div>
      {/* Pending draft confirm/cancel */}
      {isPendingDraftSelected && (
        <div className="space-y-2.5 p-3">
          <h4 className="text-muted-foreground text-xs font-semibold uppercase">Suggested field</h4>
          <p className="text-xs text-slate-600">
            This is a suggested field. Confirm to add it to the form, or cancel to discard it.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={cancelPendingMissingFieldDraft}
            >
              Cancel
            </Button>
            <Button type="button" className="flex-1" onClick={confirmPendingMissingFieldDraft}>
              Confirm
            </Button>
          </div>
        </div>
      )}

      {/* Radio group editor */}
      {(schema as any)?.radio_group_id && (
        <div className="p-3">
          <RadioGroupFieldEditor
            currentBlockId={editedBlock._id}
            allBlocks={formMetadata?.schema.blocks ?? []}
            onUpdateOptionLabel={(blockId, label) => {
              const target = formMetadata?.schema.blocks?.find((b) => b._id === blockId);
              if (!target?.field_schema) return;
              handleBlockUpdate({
                ...target,
                field_schema: { ...target.field_schema, radio_option_label: label },
              });
            }}
          />
        </div>
      )}

      <div className="space-y-2.5 p-3">
        <div className="flex h-8 items-center justify-between gap-3">
          <span className="shrink-0 text-xs text-slate-600">Field label</span>
          <input
            type="text"
            className="h-8 flex-1 rounded-[0.33em] border border-slate-300 px-2 text-xs"
            value={schema?.label || ""}
            onChange={(e) => handleFieldChange("label", e.target.value)}
          />
        </div>
        {isDefaultChildField && (
          <div className="flex h-8 items-center justify-between gap-3">
            <span className="shrink-0 text-xs text-slate-600">Field type</span>
            <select
              className="h-8 flex-1 rounded-[0.33em] border border-slate-300 px-2 text-xs"
              value={presetIdOverride ?? presetMatchingSchema?.id ?? matchedChildPreset?.id ?? ""}
              onChange={(e) => {
                const nextPreset = presetTemplates.find((preset) => preset.id === e.target.value);
                if (!nextPreset) return;
                setPresetIdOverride(e.target.value);
                handleFieldPatch(applyPresetToSchema(schema, nextPreset));
              }}
            >
              {presetOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex h-8 items-center justify-between gap-3">
          <span className="shrink-0 text-xs text-slate-600">Font size</span>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            className="h-8 w-14 rounded-[0.33em] border border-slate-300 px-2 text-xs [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-outer-spin-button]:opacity-100"
            value={getIntegerInputValue("size", schema?.size, 12)}
            onChange={(e) => handleIntegerInputChange("size", e.target.value)}
            onBlur={() => handleIntegerInputBlur("size")}
          />
        </div>
        <div className="flex h-8 items-center justify-between gap-3">
          <span className="shrink-0 text-xs text-slate-600">Text wrap</span>
          <Switch
            checked={schema?.wrap ?? true}
            onCheckedChange={(checked) => handleFieldChange("wrap", checked)}
          />
        </div>
        <div className="flex h-8 items-center justify-between gap-3">
          <span className="shrink-0 text-xs text-slate-600">Horizontal align</span>
          <div className="inline-flex divide-x divide-slate-300 overflow-hidden rounded-[0.33em] border border-slate-300">
            {(
              [
                {
                  value: "left",
                  icon: <BiAlignLeft className="h-3.5 w-3.5" />,
                  title: "Align Left",
                },
                {
                  value: "center",
                  icon: <BiAlignMiddle className="h-3.5 w-3.5" />,
                  title: "Align Center",
                },
                {
                  value: "right",
                  icon: <BiAlignRight className="h-3.5 w-3.5" />,
                  title: "Align Right",
                },
              ] as const
            ).map(({ value, icon, title }) => (
              <button
                key={value}
                type="button"
                title={title}
                onClick={() => handleFieldChange("align_h", value)}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center transition-colors",
                  (schema?.align_h || schema?.horizontal_alignment) === value
                    ? "bg-slate-800 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
        <div className="flex h-8 items-center justify-between gap-3">
          <span className="shrink-0 text-xs text-slate-600">Vertical align</span>
          <div className="inline-flex divide-x divide-slate-300 overflow-hidden rounded-[0.33em] border border-slate-300">
            {(
              [
                {
                  value: "top",
                  icon: <BiVerticalTop className="h-3.5 w-3.5" />,
                  title: "Align Top",
                },
                {
                  value: "middle",
                  icon: <BiVerticalCenter className="h-3.5 w-3.5" />,
                  title: "Align Middle",
                },
                {
                  value: "bottom",
                  icon: <BiVerticalBottom className="h-3.5 w-3.5" />,
                  title: "Align Bottom",
                },
              ] as const
            ).map(({ value, icon, title }) => (
              <button
                key={value}
                type="button"
                title={title}
                onClick={() => handleFieldChange("align_v", value)}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center transition-colors",
                  (schema?.align_v || schema?.vertical_alignment) === value
                    ? "bg-slate-800 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200" />

      <div>
        <button
          type="button"
          onClick={() => setPositionOpen((v) => !v)}
          className="text-muted-foreground flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase"
        >
          Position &amp; Size
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 rounded transition-colors hover:bg-slate-100",
              positionOpen && "rotate-180"
            )}
          />
        </button>
        {positionOpen && (
          <div className="grid grid-cols-2 gap-2 px-3 pb-3">
            <FormInput
              type="number"
              label="X"
              step="0.01"
              value={schema?.x?.toFixed(2) ?? "0.00"}
              setter={(v) => handleFieldChange("x", Number(v))}
              required={false}
              className="h-8 text-xs"
            />
            <FormInput
              type="number"
              label="Y"
              step="0.01"
              value={schema?.y?.toFixed(2) ?? "0.00"}
              setter={(v) => handleFieldChange("y", Number(v))}
              required={false}
              className="h-8 text-xs"
            />
            <FormInput
              type="number"
              label="W"
              step="0.01"
              value={schema?.w?.toFixed(2) ?? "100.00"}
              setter={(v) => handleFieldChange("w", Number(v))}
              required={false}
              className="h-8 text-xs"
            />
            <FormInput
              type="number"
              label="H"
              step="0.01"
              value={schema?.h?.toFixed(2) ?? "12.00"}
              setter={(v) => handleFieldChange("h", Number(v))}
              required={false}
              className="h-8 text-xs"
            />
            <FormInput
              type="number"
              label="Page"
              step="1"
              min="1"
              value={String(schema?.page ?? 1)}
              setter={(v) => handleFieldChange("page", Math.max(1, Number(v)))}
              required={false}
              className="h-8 text-xs"
            />
          </div>
        )}
      </div>

      <div className="border-t border-slate-200" />

      {editedBlock.field_schema && (
        <>
          <button
            type="button"
            onClick={() => setRepeatOpen((open) => !open)}
            className="text-muted-foreground flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase"
          >
            <span className="flex items-center gap-2">
              Repeat placement
              {repeat && <span className="text-indigo-500 normal-case">Enabled</span>}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 rounded transition-colors hover:bg-slate-100",
                repeatOpen && "rotate-180"
              )}
            />
          </button>
          {repeatOpen && (
            <div className="space-y-2.5 px-3 pb-3">
              <div className="flex h-8 items-center justify-between gap-3">
                <span className="shrink-0 text-xs text-slate-600">Repeat field</span>
                <Switch
                  checked={Boolean(repeat)}
                  onCheckedChange={(checked) =>
                    handleFieldChange(
                      "repeat",
                      checked ? { count: 1, offset_x: 0, offset_y: 0, start_index: 0 } : undefined
                    )
                  }
                />
              </div>
              {repeat && (
                <>
                  <p className="text-xs leading-4 text-slate-500">
                    Reuses this field&apos;s value at each placement in the generated PDF.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <FormInput
                      type="number"
                      label="Copies"
                      min="1"
                      step="1"
                      value={String(repeat.count ?? 1)}
                      setter={(value) =>
                        handleFieldChange("repeat", {
                          ...repeat,
                          count: Math.max(1, Math.floor(Number(value) || 1)),
                        })
                      }
                      required={false}
                      className="h-8 text-xs"
                    />
                    <FormInput
                      type="number"
                      label="Start index"
                      min="0"
                      step="1"
                      value={String(repeat.start_index ?? 0)}
                      setter={(value) =>
                        handleFieldChange("repeat", {
                          ...repeat,
                          start_index: Math.max(0, Math.floor(Number(value) || 0)),
                        })
                      }
                      required={false}
                      className="h-8 text-xs"
                    />
                    <FormInput
                      type="number"
                      label="X offset"
                      step="0.01"
                      value={String(repeat.offset_x ?? 0)}
                      setter={(value) =>
                        handleFieldChange("repeat", {
                          ...repeat,
                          offset_x: Number(value) || 0,
                        })
                      }
                      required={false}
                      className="h-8 text-xs"
                    />
                    <FormInput
                      type="number"
                      label="Y offset"
                      step="0.01"
                      value={String(repeat.offset_y ?? 0)}
                      setter={(value) =>
                        handleFieldChange("repeat", {
                          ...repeat,
                          offset_y: Number(value) || 0,
                        })
                      }
                      required={false}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600" htmlFor="repeat-visible-count-field">
                      Visible copies field
                    </label>
                    <select
                      id="repeat-visible-count-field"
                      className="h-8 w-full rounded-[0.33em] border border-slate-300 px-2 text-xs"
                      value={repeat.visible_count_field ?? ""}
                      onChange={(event) =>
                        handleFieldChange("repeat", {
                          ...repeat,
                          visible_count_field: event.target.value || undefined,
                        })
                      }
                    >
                      <option value="">Always show all copies</option>
                      {repeatVisibleCountFields.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="border-t border-slate-200" />
        </>
      )}

      <div className="space-y-2.5 p-3">
        <h4 className="text-muted-foreground text-xs font-semibold uppercase">
          Value &amp; Validation
        </h4>
        <div className="flex h-8 items-center justify-between gap-3">
          <span className="shrink-0 text-xs text-slate-600">Derived value</span>
          <Switch
            checked={isChildDerived}
            onCheckedChange={(checked) =>
              handleFieldChange("source", checked ? "derived" : "manual")
            }
          />
        </div>
        {isChildDerived && (
          <DefaultValueSection
            title="Default Values"
            source={childSource}
            value={(schema?.prefiller || "") as string}
            fieldOptions={childFieldOptions}
            onChange={(value) => handleFieldChange("prefiller", value)}
          />
        )}
        {showChildValidation && (
          <ValidationSection
            validator={(schema?.validator || "") as string}
            schemaType={schema?.type}
            validatorIr={(schema?.validator_ir || null) as any}
            fieldOptions={childFieldOptions}
            currentFieldId={childFieldKey}
            onChange={(next) => {
              handleFieldPatch({
                validator: next.validator,
                validator_ir: next.validator_ir,
              });
            }}
          />
        )}
        {showChildPlaceholder && (
          <div className="space-y-1.5">
            <span className="text-xs text-gray-600">Placeholder</span>
            <input
              type="text"
              className="h-8 w-full rounded-[0.33em] border border-slate-300 px-2 text-xs"
              value={placeholderDisplay}
              onChange={(e) => setPlaceholderDraft(e.target.value)}
              onBlur={() =>
                handleFieldChange("prefiller", buildManualPrefiller(placeholderDisplay))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleFieldChange("prefiller", buildManualPrefiller(placeholderDisplay));
                }
              }}
              placeholder="Type value"
            />
          </div>
        )}
        <FormTextarea
          label="Tooltip Label"
          value={schema?.tooltip_label || ""}
          setter={(value) => handleFieldChange("tooltip_label", value)}
          placeholder="Optional helper text shown beside the field"
          required={false}
          className="min-h-20"
        />
      </div>
    </div>
  );
}
