"use client";

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */

import { IFormBlock } from "@betterinternship/core/forms";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { useFormEditor } from "@/app/contexts/form-editor.context";
import { useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import { useFieldTemplateContext } from "@/app/contexts/field-template.ctx";
import { FormInput, FormTextarea, FormDropdown } from "@/components/docs/forms/EditForm";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
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
import { ValidationSection } from "@/components/docs/form-editor/validation.bundle";
import { Switch } from "@/components/ui/switch";
import {
  applyPresetToSchema,
  findPresetByFieldKey,
  isDefaultPresetFieldKey,
} from "@/lib/default-field-preset-utils";
import { resolveSystemPresetTemplates } from "@/lib/system-preset-resolver";
import { RadioGroupFieldEditor } from "./RadioGroupFieldEditor";

type FieldOption = DefaultValueFieldOption;

export function RevampedBlockEditor() {
  const { formMetadata, updateBlocks } = useFormEditor();
  const { registry } = useFieldTemplateContext();
  const {
    selectedBlockId,
    handleBlockUpdate,
    pendingMissingFieldDraft,
    setPendingMissingFieldDraft,
    confirmPendingMissingFieldDraft,
    cancelPendingMissingFieldDraft,
  } = useFormEditorTab();

  const block = selectedBlockId
    ? formMetadata?.schema.blocks?.find((b) => b._id === selectedBlockId) || null
    : null;
  const isPendingDraftSelected =
    Boolean(pendingMissingFieldDraft) &&
    selectedBlockId === pendingMissingFieldDraft?._id &&
    !block;
  const activeBlock = block || (isPendingDraftSelected ? pendingMissingFieldDraft : null);

  const [editedBlock, setEditedBlock] = useState<IFormBlock | null>(activeBlock);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [presetIdOverride, setPresetIdOverride] = useState<string | null>(null);

  type IntegerFieldKey = "size";
  const [integerDrafts, setIntegerDrafts] = useState<Partial<Record<IntegerFieldKey, string>>>({});
  const INTEGER_FIELD_CONFIG: Record<IntegerFieldKey, { allowNegative: boolean; min?: number }> = {
    size: { allowNegative: false, min: 0 },
  };

  useEffect(() => {
    setEditedBlock(activeBlock);
  }, [activeBlock]);

  useEffect(() => {
    setIntegerDrafts({});
    setShowAdvancedSettings(false);
    setPresetIdOverride(null);
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
      const radioGroupId = (editedBlock.field_schema as any)?.radio_group_id as
        | string
        | undefined;
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
  const childFieldKey = String(schema?.field || "");
  const isDefaultChildField = isDefaultPresetFieldKey(childFieldKey, presetTemplates);
  const matchedChildPreset = findPresetByFieldKey(childFieldKey, presetTemplates);

  return (
    <div className="divide-y divide-slate-200">
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

      {/* Label & Type */}
      <div className="space-y-2.5 p-3">
        <h4 className="text-muted-foreground text-xs font-semibold uppercase">Label & Type</h4>
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
              value={presetIdOverride ?? matchedChildPreset?.id ?? ""}
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
      </div>

      {/* Layout & Text (font size, wrap, H alignment, V alignment) */}
      <div className="space-y-2 p-3">
        <h4 className="text-muted-foreground text-xs font-semibold uppercase">Layout & Text</h4>
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

      <>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-between bg-red-900/5 p-3 transition-colors hover:bg-red-50/70"
          onClick={() => setShowAdvancedSettings((prev) => !prev)}
        >
          <h4 className="text-xs font-semibold text-red-700/80 uppercase">Advanced settings</h4>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-slate-400 transition-transform",
              showAdvancedSettings && "rotate-180"
            )}
          />
        </button>
        {showAdvancedSettings && (
          <div className="space-y-2.5 bg-red-900/5 p-3">
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
                hideTitle
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
                hideTitle
                onChange={(next) => {
                  handleFieldPatch({
                    validator: next.validator,
                    validator_ir: next.validator_ir,
                  });
                }}
              />
            )}
            {showChildPlaceholder && (
              <DefaultValueSection
                title="Placeholder"
                hideTitle
                source={childSource}
                value={(schema?.prefiller || "") as string}
                fieldOptions={childFieldOptions}
                simpleMode="manual-only"
                onChange={(value) => handleFieldChange("prefiller", value)}
              />
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
        )}
      </>
    </div>
  );
}
