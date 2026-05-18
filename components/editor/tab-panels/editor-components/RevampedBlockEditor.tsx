"use client";

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */

import { IFormBlock } from "@betterinternship/core/forms";
import { useState, useEffect, useMemo } from "react";
import { useFormEditor } from "@/app/contexts/form-editor.context";
import { useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import { usePdfViewer } from "@/app/contexts/pdf-viewer.context";
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
import { getPartyColorByIndex } from "@/lib/party-colors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
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

function RecipientBadgeDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; name: string; order?: number }[];
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.id === value) || options[0];
  const selectedColor = getPartyColorByIndex(Math.max(0, (selected?.order || 1) - 1));

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center justify-between rounded-[0.33em] border border-slate-300 bg-white px-2.5 text-sm"
        >
          <span
            className="max-w-[calc(100%-1.5rem)] truncate rounded-full px-2 py-0.5 text-xs font-semibold text-white"
            style={{ backgroundColor: selectedColor.hex }}
          >
            {selected?.name || "Select recipient"}
          </span>
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-[0.33em]"
      >
        {options.map((option) => {
          const color = getPartyColorByIndex(Math.max(0, (option.order || 1) - 1));
          return (
            <DropdownMenuItem
              key={option.id}
              onClick={() => onChange(option.id)}
              className="py-1.5"
            >
              <span
                className="max-w-full truncate rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                style={{ backgroundColor: color.hex }}
              >
                {option.name}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type FieldOption = DefaultValueFieldOption;

export function RevampedBlockEditor() {
  const { formMetadata } = useFormEditor();
  const { pageCount } = usePdfViewer();
  const { registry } = useFieldTemplateContext();
  const {
    selectedBlockId,
    selectedBlockGroup,
    handleBlockUpdate,
    handleParentUpdate,
    editorViewMode,
    pendingMissingFieldDraft,
    setPendingMissingFieldDraft,
    confirmPendingMissingFieldDraft,
    cancelPendingMissingFieldDraft,
  } = useFormEditorTab();

  // Get the selected block and parent group from context
  const block = selectedBlockId
    ? formMetadata?.schema.blocks?.find((b) => b._id === selectedBlockId) || null
    : null;
  const isPendingDraftSelected =
    Boolean(pendingMissingFieldDraft) && selectedBlockId === pendingMissingFieldDraft?._id && !block;
  const activeBlock = block || (isPendingDraftSelected ? pendingMissingFieldDraft : null);
  const parentGroup = selectedBlockGroup;

  const [editedBlock, setEditedBlock] = useState<IFormBlock | null>(activeBlock);
  const [editedTextContent, setEditedTextContent] = useState<string>("");
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Local state for immediate typing feedback - will sync back to formMetadata through handler
  // This allows responsive typing while formMetadata remains the authoritative source
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});
  type IntegerFieldKey = "x" | "y" | "w" | "h" | "size" | "page";
  const [integerDrafts, setIntegerDrafts] = useState<Partial<Record<IntegerFieldKey, string>>>({});
  const INTEGER_FIELD_CONFIG: Record<IntegerFieldKey, { allowNegative: boolean; min?: number }> = {
    x: { allowNegative: true },
    y: { allowNegative: true },
    w: { allowNegative: false, min: 0 },
    h: { allowNegative: false, min: 0 },
    size: { allowNegative: false, min: 0 },
    page: { allowNegative: false, min: 1 },
  };

  useEffect(() => {
    setEditedBlock(activeBlock);
  }, [activeBlock]);

  // Update editedTextContent when selectedBlockGroup changes
  useEffect(() => {
    if (parentGroup) {
      const isHeaderOrParagraph =
        parentGroup.fieldName === "header" || parentGroup.fieldName === "paragraph";

      const matchingBlocks =
        formMetadata?.schema.blocks?.filter((b: any) => {
          // For headers/paragraphs, match by the group ID which is the block's _id
          if (isHeaderOrParagraph) {
            return (
              b._id === parentGroup.id &&
              (b.signing_party_id === parentGroup.partyId ||
                (b.signing_party_id === "" && parentGroup.partyId === "unknown") ||
                (b.signing_party_id === "unknown" && parentGroup.partyId === ""))
            );
          }

          // For form fields, match by field name and partyId
          return (
            (b.field_schema?.field === parentGroup.fieldName || b._id === parentGroup.fieldName) &&
            (b.signing_party_id === parentGroup.partyId ||
              (b.signing_party_id === "" && parentGroup.partyId === "unknown") ||
              (b.signing_party_id === "unknown" && parentGroup.partyId === ""))
          );
        }) || [];
      const firstBlock = matchingBlocks[0];
      if (firstBlock) {
        setEditedTextContent(firstBlock.text_content || "");
      }
    }
  }, [parentGroup, formMetadata?.schema.blocks]);

  // Clear editing values when parent group changes (formMetadata is now the source)
  useEffect(() => {
    setEditingValues({});
  }, [parentGroup?.id]);

  useEffect(() => {
    setIntegerDrafts({});
  }, [parentGroup?.id, editedBlock?._id]);

  useEffect(() => {
    setShowAdvancedSettings(false);
  }, [parentGroup?.id, editedBlock?._id]);

  const getSource = (schema: any) => (schema?.source as string) || "manual";
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

  const getFieldOptions = () => {
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

    if (
      key === "x" ||
      key === "y" ||
      key === "w" ||
      key === "h" ||
      key === "page" ||
      key === "size" ||
      key === "wrap" ||
      key === "align_h" ||
      key === "align_v"
    ) {
      // PDF editor fields
      if (editedBlock.field_schema) {
        updated.field_schema = { ...editedBlock.field_schema, [key]: value };
      } else if (editedBlock.phantom_field_schema) {
        updated.phantom_field_schema = { ...editedBlock.phantom_field_schema, [key]: value };
      }
    } else {
      // Form editor fields
      if (editedBlock.field_schema) {
        updated.field_schema = { ...editedBlock.field_schema, [key]: value };
      } else if (editedBlock.phantom_field_schema) {
        updated.phantom_field_schema = { ...editedBlock.phantom_field_schema, [key]: value };
      }
    }

    // Update local state for immediate UI feedback
    setEditedBlock(updated);

    if (isPendingDraftSelected) {
      setPendingMissingFieldDraft(updated);
      return;
    }

    // Use context handler to update and sync for persisted fields
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
    let nextValue = min !== undefined ? Math.max(min, parsed) : parsed;
    if (key === "page" && pageCount > 0) {
      nextValue = Math.min(nextValue, pageCount);
    }
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

  if (!editedBlock && !parentGroup) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Select a field to edit</p>
      </div>
    );
  }

  if (editorViewMode === "form" && editedBlock && !parentGroup) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">
          Select a row from Form View to edit settings
        </p>
      </div>
    );
  }

  // Handle parent group editing - Show form-level properties
  if (parentGroup && !editedBlock) {
    // Find a block that matches the fieldName and partyId to get its metadata
    const isHeaderOrParagraph =
      parentGroup.fieldName === "header" || parentGroup.fieldName === "paragraph";

    const matchingBlocks =
      formMetadata?.schema.blocks?.filter((b: any) => {
        // For headers/paragraphs, match by the group ID which is the block's _id
        if (isHeaderOrParagraph) {
          const matches =
            b._id === parentGroup.id &&
            (b.signing_party_id === parentGroup.partyId ||
              (b.signing_party_id === "" && parentGroup.partyId === "unknown") ||
              (b.signing_party_id === "unknown" && parentGroup.partyId === ""));
          return matches;
        }

        // For form fields, match by field name and partyId
        return (
          (b.field_schema?.field === parentGroup.fieldName ||
            b.phantom_field_schema?.field === parentGroup.fieldName ||
            b._id === parentGroup.fieldName) &&
          (b.signing_party_id === parentGroup.partyId ||
            (b.signing_party_id === "" && parentGroup.partyId === "unknown") ||
            (b.signing_party_id === "unknown" && parentGroup.partyId === ""))
        );
      }) || [];

    // Get the first matching block to extract metadata from
    const firstBlock = matchingBlocks[0];
    if (!firstBlock) {
      return (
        <div className="flex h-full items-center justify-center p-4">
          <p className="text-muted-foreground text-sm">Block metadata not found</p>
        </div>
      );
    }

    const blockType = firstBlock.block_type || "form_field";
    const fieldMetadata = firstBlock.field_schema || firstBlock.phantom_field_schema;
    // Treat only header and paragraph as simple text-only blocks
    const isSimpleBlock = ["header", "paragraph"].includes(blockType);

    if (!fieldMetadata && !isSimpleBlock) {
      return (
        <div className="flex h-full items-center justify-center p-4">
          <p className="text-muted-foreground text-sm">Field metadata not found</p>
        </div>
      );
    }

    const parentSource =
      (editingValues.source !== undefined ? editingValues.source : fieldMetadata?.source) ||
      "manual";
    const isParentDerived = parentSource === "derived";
    const isParentPrefill = parentSource === "prefill";
    const isParentAuto = parentSource === "auto";
    const showParentValidation = !isParentDerived && !isParentPrefill && !isParentAuto;
    const showParentPlaceholder = !isParentDerived && !isParentAuto;
    const parentSchemaType =
      (editingValues.type !== undefined ? editingValues.type : fieldMetadata?.type) || "text";
    const parentPrefillerValue = (
      editingValues.prefiller !== undefined
        ? editingValues.prefiller
        : fieldMetadata?.prefiller || ""
    ) as string;
    const parentValidatorValue = (
      editingValues.validator !== undefined
        ? editingValues.validator
        : fieldMetadata?.validator || ""
    ) as string;
    const parentValidatorIrValue =
      editingValues.validator_ir !== undefined
        ? editingValues.validator_ir
        : (fieldMetadata as any)?.validator_ir || null;
    const parentFieldOptions = getFieldOptions();
    const parentFieldKey = String(fieldMetadata?.field || "");
    const isDefaultParentField = isDefaultPresetFieldKey(parentFieldKey, presetTemplates);
    const matchedParentPreset = findPresetByFieldKey(parentFieldKey, presetTemplates);

    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-auto p-3">
          <Card className="gap-2 p-2.5">
            <h4 className="text-muted-foreground text-xs font-semibold uppercase">Recipient</h4>
            <RecipientBadgeDropdown
              value={
                (editingValues.signingPartyId !== undefined
                  ? editingValues.signingPartyId
                  : parentGroup.partyId) || ""
              }
              options={(formMetadata?.signing_parties || []).map((party, idx) => ({
                id: party._id,
                name: party.signatory_title || party._id,
                order: idx + 1,
              }))}
              onChange={(value) => {
                setEditingValues((prev) => ({ ...prev, signingPartyId: value }));
                if (parentGroup) {
                  handleParentUpdate(parentGroup.id, { signing_party_id: value });
                }
              }}
            />
          </Card>

          {/* Text Content - for header, paragraph, phantom_field */}
          {isSimpleBlock && (
            <Card className="gap-2.5 p-2.5">
              <h4 className="text-muted-foreground text-xs font-semibold uppercase">
                Text content
              </h4>
              <FormTextarea
                value={editedTextContent}
                setter={(value) => {
                  setEditedTextContent(value);
                  // For simple blocks, update all matching instances
                  matchingBlocks.forEach((block) => {
                    handleBlockUpdate({ ...block, text_content: value });
                  });
                }}
                placeholder={
                  blockType === "header"
                    ? "Enter header text"
                    : blockType === "paragraph"
                      ? "Enter paragraph text"
                      : "Enter placeholder text"
                }
                required={false}
                className="min-h-28"
              />
            </Card>
          )}

          {/* Field settings */}
          {!isSimpleBlock && fieldMetadata && (
            <Card className="gap-2.5 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-muted-foreground text-xs font-semibold uppercase">
                  Field settings
                </h4>
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
                value={
                  editingValues.fieldLabel !== undefined
                    ? editingValues.fieldLabel
                    : fieldMetadata.label || ""
                }
                setter={(value) => {
                  setEditingValues((prev) => ({ ...prev, fieldLabel: value }));
                  if (parentGroup) {
                    handleParentUpdate(parentGroup.id, { fieldLabel: value });
                  }
                }}
                placeholder="e.g., Full Name"
                required={false}
              />
              {showAdvancedSettings && (
                <FormTextarea
                  label="Tooltip Label"
                  value={
                    editingValues.tooltip_label !== undefined
                      ? editingValues.tooltip_label
                      : fieldMetadata.tooltip_label || ""
                  }
                  setter={(value) => {
                    setEditingValues((prev) => ({ ...prev, tooltip_label: value }));
                    if (parentGroup) {
                      handleParentUpdate(parentGroup.id, { tooltip_label: value });
                    }
                  }}
                  placeholder="Optional helper text shown beside the field"
                  required={false}
                  className="min-h-20"
                />
              )}

              {isDefaultParentField && (
                <FormDropdown
                  label="Field Type"
                  value={matchedParentPreset?.id || ""}
                  options={presetOptions}
                  setter={(value) => {
                    const nextPreset = presetTemplates.find((preset) => preset.id === value);
                    if (!nextPreset || !parentGroup) return;
                    const presetPatch = applyPresetToSchema(fieldMetadata, nextPreset);
                    setEditingValues((prev) => ({
                      ...prev,
                      ...presetPatch,
                    }));
                    handleParentUpdate(parentGroup.id, presetPatch);
                  }}
                  required={false}
                />
              )}

              {isParentDerived ? (
                <>
                  <div className="flex items-center justify-between rounded-[0.33em] border border-slate-200 px-2.5 py-2">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-slate-700">Derived value</p>
                    </div>
                    <Switch
                      checked={isParentDerived}
                      onCheckedChange={(checked) => {
                        const nextSource = checked ? "derived" : "manual";
                        setEditingValues((prev) => ({ ...prev, source: nextSource }));
                        if (parentGroup) handleParentUpdate(parentGroup.id, { source: nextSource });
                      }}
                    />
                  </div>
                  <DefaultValueSection
                    title="Default Values"
                    source={parentSource}
                    value={parentPrefillerValue}
                    fieldOptions={parentFieldOptions}
                    onChange={(value) => {
                      setEditingValues((prev) => ({ ...prev, prefiller: value }));
                      if (parentGroup) handleParentUpdate(parentGroup.id, { prefiller: value });
                    }}
                  />
                </>
              ) : (
                <>
                  {showParentValidation && (
                    <ValidationSection
                      validator={parentValidatorValue}
                      schemaType={parentSchemaType}
                      validatorIr={parentValidatorIrValue as any}
                      fieldOptions={parentFieldOptions}
                      currentFieldId={parentFieldKey}
                      onChange={(next) => {
                        setEditingValues((prev) => ({
                          ...prev,
                          validator: next.validator,
                          validator_ir: next.validator_ir,
                        }));
                        if (parentGroup)
                          handleParentUpdate(parentGroup.id, {
                            validator: next.validator,
                            validator_ir: next.validator_ir,
                          } as any);
                      }}
                    />
                  )}
                  {showParentPlaceholder && (
                    <div className="mt-4">
                      <DefaultValueSection
                        title="Placeholder"
                        source={parentSource}
                        value={parentPrefillerValue}
                        fieldOptions={parentFieldOptions}
                        simpleMode="manual-only"
                        onChange={(value) => {
                          setEditingValues((prev) => ({ ...prev, prefiller: value }));
                          if (parentGroup) handleParentUpdate(parentGroup.id, { prefiller: value });
                        }}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between rounded-[0.33em] border border-slate-200 px-2.5 py-2">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-slate-700">Derived value</p>
                    </div>
                    <Switch
                      checked={isParentDerived}
                      onCheckedChange={(checked) => {
                        const nextSource = checked ? "derived" : "manual";
                        setEditingValues((prev) => ({ ...prev, source: nextSource }));
                        if (parentGroup) handleParentUpdate(parentGroup.id, { source: nextSource });
                      }}
                    />
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    );
  }

  if (!editedBlock) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Select a field to edit</p>
      </div>
    );
  }

  const schema = (editedBlock.field_schema || editedBlock.phantom_field_schema) as any;
  const childFieldOptions = getFieldOptions();
  const childSource = getSource(schema);
  const isChildDerived = childSource === "derived";
  const isChildPrefill = childSource === "prefill";
  const isChildAuto = childSource === "auto";
  const showChildValidation = !isChildDerived && !isChildPrefill && !isChildAuto;
  const showChildPlaceholder = !isChildDerived && !isChildAuto;
  const childFieldKey = String(schema?.field || "");
  const isDefaultChildField = isDefaultPresetFieldKey(childFieldKey, presetTemplates);
  const matchedChildPreset = findPresetByFieldKey(childFieldKey, presetTemplates);

  // Child/Instance editing - Show PDF-level properties (coordinates, alignment, font size, wrap)
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-3 overflow-auto p-3">
        <Card className="gap-2 p-2.5">
          <h4 className="text-muted-foreground text-xs font-semibold uppercase">Recipient</h4>
          <RecipientBadgeDropdown
            value={editedBlock.signing_party_id || ""}
            options={(formMetadata?.signing_parties || []).map((party, idx) => ({
              id: party._id,
              name: party.signatory_title || party._id,
              order: idx + 1,
            }))}
            onChange={(value) => {
              const updatedBlock = { ...editedBlock, signing_party_id: value };
              setEditedBlock(updatedBlock);
              if (isPendingDraftSelected) {
                setPendingMissingFieldDraft(updatedBlock);
                return;
              }
              handleBlockUpdate(updatedBlock);
            }}
          />
        </Card>

        {isPendingDraftSelected ? (
          <Card className="gap-2.5 p-2.5">
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
          </Card>
        ) : null}

        <Card className="gap-2.5 p-2.5">
          <h4 className="text-muted-foreground text-xs font-semibold uppercase">Layout & Text</h4>
          <div className="grid grid-cols-2 gap-2">
            <FormInput
              label="X"
              required={false}
              type="number"
              inputMode="numeric"
              pattern="-?[0-9]*"
              value={getIntegerInputValue("x", schema?.x, 0)}
              setter={(value) => handleIntegerInputChange("x", value)}
              onBlur={() => handleIntegerInputBlur("x")}
            />
            <FormInput
              label="Y"
              required={false}
              type="number"
              inputMode="numeric"
              pattern="-?[0-9]*"
              value={getIntegerInputValue("y", schema?.y, 0)}
              setter={(value) => handleIntegerInputChange("y", value)}
              onBlur={() => handleIntegerInputBlur("y")}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormInput
              label="Width"
              required={false}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={getIntegerInputValue("w", schema?.w, 100)}
              setter={(value) => handleIntegerInputChange("w", value)}
              onBlur={() => handleIntegerInputBlur("w")}
            />
            <FormInput
              label="Height"
              required={false}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={getIntegerInputValue("h", schema?.h, 20)}
              setter={(value) => handleIntegerInputChange("h", value)}
              onBlur={() => handleIntegerInputBlur("h")}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormInput
              label="Page"
              required={false}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={getIntegerInputValue("page", schema?.page, 1)}
              setter={(value) => handleIntegerInputChange("page", value)}
              onBlur={() => handleIntegerInputBlur("page")}
            />
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
          </div>
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
    </div>
  );
}
