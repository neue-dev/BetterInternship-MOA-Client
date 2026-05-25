"use client";

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */

import { IFormBlock } from "@betterinternship/core/forms";
import { useState, useEffect, useMemo } from "react";
import { useFormEditor } from "@/app/contexts/form-editor.context";
import { useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import { useFieldTemplateContext } from "@/app/contexts/field-template.ctx";
import { FormInput, FormTextarea, FormDropdown } from "@/components/docs/forms/EditForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  BiAlignLeft,
  BiAlignMiddle,
  BiAlignRight,
  BiVerticalBottom,
  BiVerticalCenter,
  BiVerticalTop,
} from "react-icons/bi";
import { SlidersHorizontal } from "lucide-react";
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
    <div className="space-y-3 p-3">
      {/* Pending draft confirm/cancel */}
      {isPendingDraftSelected && (
        <Card className="gap-2.5 p-2.5">
          <h4 className="text-muted-foreground text-xs font-semibold uppercase">
            Suggested field
          </h4>
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
        </Card>
      )}

      {/* Radio group editor */}
      {(schema as any)?.radio_group_id && (
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
      )}

      {/* Layout: font size and text wrap */}
      <Card className="gap-2.5 p-2.5">
        <h4 className="text-muted-foreground text-xs font-semibold uppercase">Layout & Text</h4>
        <FormInput
          label="Font size"
          required={false}
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={getIntegerInputValue("size", schema?.size, 12)}
          setter={(value) => handleIntegerInputChange("size", value)}
          onBlur={() => handleIntegerInputBlur("size")}
        />
        <div className="space-y-1">
          <p className="text-xs text-slate-600">Text wrap</p>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={(schema?.wrap ?? true) ? "default" : "outline"}
              onClick={() => handleFieldChange("wrap", true)}
              title="Wrap"
              className="h-8 flex-1"
            >
              Wrap
            </Button>
            <Button
              size="sm"
              variant={(schema?.wrap ?? true) ? "outline" : "default"}
              onClick={() => handleFieldChange("wrap", false)}
              title="No wrap"
              className="h-8 flex-1"
            >
              No wrap
            </Button>
          </div>
        </div>
      </Card>

      {/* Text Alignment */}
      <Card className="gap-2.5 p-2.5">
        <h4 className="text-muted-foreground text-xs font-semibold uppercase">Text Alignment</h4>
        <div className="space-y-1">
          <p className="text-xs text-slate-600">Horizontal</p>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={
                (schema?.align_h || schema?.horizontal_alignment) === "left"
                  ? "default"
                  : "outline"
              }
              onClick={() => handleFieldChange("align_h", "left")}
              title="Align Left"
              className="h-8 flex-1"
            >
              <BiAlignLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={
                (schema?.align_h || schema?.horizontal_alignment) === "center"
                  ? "default"
                  : "outline"
              }
              onClick={() => handleFieldChange("align_h", "center")}
              title="Align Center"
              className="h-8 flex-1"
            >
              <BiAlignMiddle className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={
                (schema?.align_h || schema?.horizontal_alignment) === "right"
                  ? "default"
                  : "outline"
              }
              onClick={() => handleFieldChange("align_h", "right")}
              title="Align Right"
              className="h-8 flex-1"
            >
              <BiAlignRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-slate-600">Vertical</p>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={
                (schema?.align_v || schema?.vertical_alignment) === "top" ? "default" : "outline"
              }
              onClick={() => handleFieldChange("align_v", "top")}
              title="Align Top"
              className="h-8 flex-1"
            >
              <BiVerticalTop className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={
                (schema?.align_v || schema?.vertical_alignment) === "middle"
                  ? "default"
                  : "outline"
              }
              onClick={() => handleFieldChange("align_v", "middle")}
              title="Align Middle"
              className="h-8 flex-1"
            >
              <BiVerticalCenter className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={
                (schema?.align_v || schema?.vertical_alignment) === "bottom"
                  ? "default"
                  : "outline"
              }
              onClick={() => handleFieldChange("align_v", "bottom")}
              title="Align Bottom"
              className="h-8 flex-1"
            >
              <BiVerticalBottom className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Field settings */}
      <Card className="gap-2.5 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-muted-foreground text-xs font-semibold uppercase">Field settings</h4>
          <Button
            type="button"
            size="icon"
            variant={showAdvancedSettings ? "default" : "ghost"}
            className="h-7 w-7"
            title={showAdvancedSettings ? "Hide advanced settings" : "Show advanced settings"}
            onClick={() => setShowAdvancedSettings((prev) => !prev)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
        <FormInput
          label="Field Label"
          value={schema?.label || ""}
          setter={(value) => handleFieldChange("label", value)}
          required={false}
        />
        {showAdvancedSettings && (
          <FormTextarea
            label="Tooltip Label"
            value={schema?.tooltip_label || ""}
            setter={(value) => handleFieldChange("tooltip_label", value)}
            placeholder="Optional helper text shown beside the field"
            required={false}
            className="min-h-20"
          />
        )}
        {isDefaultChildField && (
          <FormDropdown
            label="Field Type"
            value={matchedChildPreset?.id || ""}
            options={presetOptions}
            setter={(value) => {
              const nextPreset = presetTemplates.find((preset) => preset.id === value);
              if (!nextPreset) return;
              const presetPatch = applyPresetToSchema(schema, nextPreset);
              handleFieldPatch(presetPatch);
            }}
            required={false}
          />
        )}
        {isChildDerived ? (
          <>
            <div className="flex items-center justify-between rounded-[0.33em] border border-slate-200 px-2.5 py-2">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-700">Derived value</p>
              </div>
              <Switch
                checked={isChildDerived}
                onCheckedChange={(checked) =>
                  handleFieldChange("source", checked ? "derived" : "manual")
                }
              />
            </div>
            <DefaultValueSection
              title="Default Values"
              source={childSource}
              value={(schema?.prefiller || "") as string}
              fieldOptions={childFieldOptions}
              onChange={(value) => handleFieldChange("prefiller", value)}
            />
          </>
        ) : (
          <>
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
              <div className="mt-4">
                <DefaultValueSection
                  title="Placeholder"
                  source={childSource}
                  value={(schema?.prefiller || "") as string}
                  fieldOptions={childFieldOptions}
                  simpleMode="manual-only"
                  onChange={(value) => handleFieldChange("prefiller", value)}
                />
              </div>
            )}
            <div className="flex items-center justify-between rounded-[0.33em] border border-slate-200 px-2.5 py-2">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-700">Derived value</p>
              </div>
              <Switch
                checked={isChildDerived}
                onCheckedChange={(checked) =>
                  handleFieldChange("source", checked ? "derived" : "manual")
                }
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
