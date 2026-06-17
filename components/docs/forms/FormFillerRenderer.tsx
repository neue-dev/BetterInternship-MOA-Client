"use client";

import { useEffect, useMemo, useRef } from "react";
import { ClientBlock } from "@betterinternship/core/forms";
import { FieldRenderer } from "./FieldRenderer";
import { RadioGroupFiller } from "./RadioGroupFiller";
import { HeaderRenderer, ParagraphRenderer } from "@/components/docs/forms/BlockrRenderer";
import { useFormRendererContext } from "./form-renderer.ctx";
import { FormActionButtons } from "./FormActionButtons";
import { getBlockField, isBlockField } from "./utils";
import { useFormFiller } from "./form-filler.ctx";
import { useMyAutofill } from "@/hooks/use-my-autofill";
import { getSignatureImageFieldKey } from "@betterinternship/core/forms";

/**
 * Opt-in editor affordances for BlocksRenderer. Default-off so the live signer
 * filler is unaffected. The form preview editor supplies these to surface a
 * Notion/Tally-style hover drag handle, inline adders, and inline text editing.
 */
export interface BlocksRendererEditing {
  // Maps a rendered block to its FormViewUnit id, or null when the row is not
  // an editable unit (e.g. non-manual/invisible fields) and should get no UI.
  resolveUnitId: (block: ClientBlock<any>) => string | null;
  // Editable replacement for read-only header/paragraph text. Returns null to
  // fall back to the static renderer.
  renderTextBlock?: (block: ClientBlock<any>) => React.ReactNode | null;
  // Fixed adder rendered above the first row (and as the empty-state adder).
  renderTopAdder?: () => React.ReactNode;
  // Wraps an editable row with all editor chrome (drag handle, controls,
  // adders, drop indicators) and returns the keyed list element.
  wrapRow: (rowKey: string, unitId: string, content: React.ReactNode) => React.ReactNode;
}

interface FormFillerRendererProps {
  hideActions?: boolean;
  onFieldSelect?: (fieldId: string) => void;
  selectionTick?: number;
  autoScrollToSelectedField?: boolean;
}

export function FormFillerRenderer({
  hideActions = false,
  onFieldSelect,
  selectionTick = 0,
  autoScrollToSelectedField = true,
}: FormFillerRendererProps) {
  const form = useFormRendererContext();
  const formFiller = useFormFiller();
  const autofillValues = useMyAutofill();
  const filteredBlocks = form.blocks;
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Deduplicate blocks: only keep first instance of each field ID.
  // Signatures are recipient-level inputs, so multiple placements for the same recipient
  // collapse into one list entry while still filling every signature field for that recipient.
  const deduplicatedBlocks = useMemo(() => {
    const seenFieldIds = new Set<string>();
    const seenSignatureRecipientIds = new Set<string>();
    return filteredBlocks.filter((block) => {
      if (!isBlockField(block)) return true; // Always include non-field blocks
      const field = getBlockField(block);
      if (!field) return true;

      if (field.type === "signature" && field.signing_party_id) {
        if (seenSignatureRecipientIds.has(field.signing_party_id)) return false;
        seenSignatureRecipientIds.add(field.signing_party_id);
      }

      if (seenFieldIds.has(field.field)) return false;
      seenFieldIds.add(field.field);
      return true;
    });
  }, [filteredBlocks]);

  const finalValues = useMemo(
    () => formFiller.getFinalValues(autofillValues),
    [formFiller, autofillValues]
  );

  // Strip signature image data — only text signatures are allowed
  const sanitizedValues = useMemo(() => {
    const cleaned = { ...finalValues };
    for (const key of Object.keys(cleaned)) {
      if (key.startsWith("__signatureImage:")) {
        delete cleaned[key];
      }
    }
    return cleaned;
  }, [finalValues]);

  // Clear any persisted signature image data from formFiller state on mount
  useEffect(() => {
    for (const key of Object.keys(formFiller.getFinalValues())) {
      if (key.startsWith("__signatureImage:")) {
        formFiller.setValue(key, "");
      }
    }
  }, []);

  // Scroll to selected field
  useEffect(() => {
    if (
      !autoScrollToSelectedField ||
      !form.selectedPreviewId ||
      !fieldRefs.current[form.selectedPreviewId]
    ) {
      return;
    }

    const fieldElement = fieldRefs.current[form.selectedPreviewId];
    const scrollContainer = scrollContainerRef.current;

    if (fieldElement && scrollContainer) {
      // Scroll the field into view with a small padding
      fieldElement.scrollIntoView({ behavior: "smooth", block: "nearest" });

      // Add a highlight animation
      fieldElement.classList.add("ring-2", "ring-blue-400", "ring-offset-2", "rounded");
      setTimeout(() => {
        fieldElement.classList.remove("ring-2", "ring-blue-400", "ring-offset-2", "rounded");
      }, 1500);
    }
  }, [autoScrollToSelectedField, form.selectedPreviewId, selectionTick]);

  return (
    <div className="relative flex h-full flex-col">
      <div ref={scrollContainerRef} className="relative flex flex-1 flex-col overflow-auto">
        <div className="mb-5 flex-1 space-y-3 px-7">
          <BlocksRenderer
            formKey={form.formName}
            blocks={deduplicatedBlocks}
            values={sanitizedValues}
            onChange={formFiller.setValue}
            errors={formFiller.errors}
            setSelected={(fieldId) => {
              if (onFieldSelect) {
                onFieldSelect(fieldId);
                return;
              }
              form.setSelectedPreviewId(fieldId);
            }}
            onBlurValidate={(fieldKey, field, nextValue) =>
              formFiller.validateField(fieldKey, field, autofillValues, nextValue)
            }
            fieldRefs={fieldRefs.current}
            selectedFieldId={form.selectedPreviewId}
          />
        </div>
      </div>
      {!hideActions && (
        <div className="hidden border-t border-r border-gray-300 bg-gray-100 p-2 sm:block">
          <FormActionButtons />
        </div>
      )}
    </div>
  );
}

export const BlocksRenderer = <T extends any[]>({
  formKey,
  blocks,
  values,
  onChange,
  errors,
  setSelected,
  onBlurValidate,
  fieldRefs,
  selectedFieldId,
  editing,
}: {
  formKey: string;
  blocks: ClientBlock<T>[];
  values: Record<string, string>;
  onChange: (key: string, value: any) => void;
  errors: Record<string, string>;
  setSelected: (selected: string) => void;
  onBlurValidate?: (fieldKey: string, field: any, nextValue?: unknown) => void;
  fieldRefs: Record<string, HTMLDivElement | null>;
  selectedFieldId?: string | null;
  editing?: BlocksRendererEditing;
}) => {
  if (!blocks.length) {
    return editing?.renderTopAdder ? <>{editing.renderTopAdder()}</> : null;
  }
  const form = useFormRendererContext();
  const sortedBlocks = blocks.toSorted((a, b) => a.order - b.order);

  // Pre-compute radio groups so we can collapse them into a single dropdown
  const radioGroupMap = new Map<string, typeof sortedBlocks>();
  for (const block of sortedBlocks) {
    const groupId = (block.field_schema as any)?.radio_group_id as string | undefined;
    if (!groupId) continue;
    if (!radioGroupMap.has(groupId)) radioGroupMap.set(groupId, []);
    radioGroupMap.get(groupId)!.push(block);
  }
  const renderedRadioGroups = new Set<string>();

  // Delegates editable rows to the editing adapter's wrapRow (drag handle,
  // controls, adders, drop indicators). When no adapter is present, or the row
  // is not an editable unit, renders exactly the original markup (live filler
  // is unaffected).
  const renderRow = (key: string, block: ClientBlock<T>, content: React.ReactNode) => {
    const unitId = editing?.resolveUnitId(block) ?? null;
    if (!editing || !unitId) {
      return <div key={key}>{content}</div>;
    }
    return editing.wrapRow(key, unitId, content);
  };

  const rows = sortedBlocks.map((block, i) => {
    const isForm = isBlockField(block);
    const field = isForm ? getBlockField(block) : null;
    const blockKey = `${formKey}:${field?.field || block.block_type}:${i}`;

    // Collapse all blocks in a radio group into a single dropdown
    const radioGroupId = (block.field_schema as any)?.radio_group_id as string | undefined;
    if (radioGroupId) {
      if (renderedRadioGroups.has(radioGroupId)) return null;
      renderedRadioGroups.add(radioGroupId);
      return renderRow(
        `radio-group-${radioGroupId}`,
        block,
        <RadioGroupFiller
          blocks={radioGroupMap.get(radioGroupId)!}
          values={values}
          onChange={onChange}
          errors={errors}
          setSelected={setSelected}
          selectedFieldId={selectedFieldId}
          fieldRefs={fieldRefs}
        />
      );
    }

    // Only check selection for form fields
    const signatureFieldsForRecipient =
      field?.type === "signature" && field.signing_party_id
        ? form.formMetadata.getSignatureFieldsForClientService(field.signing_party_id)
        : [];
    const isSelected =
      isForm &&
      field &&
      (selectedFieldId === field.field ||
        signatureFieldsForRecipient.some(
          (signatureField) => signatureField.field === selectedFieldId
        ));
    const handleFieldChange = (value: any) => {
      if (!field) return;
      if (!signatureFieldsForRecipient.length) {
        onChange(field.field, value);
        return;
      }

      for (const signatureField of signatureFieldsForRecipient) {
        onChange(signatureField.field, value);
      }
    };
    const handleAuxValueChange = (key: string, value: any) => {
      if (!signatureFieldsForRecipient.length) {
        onChange(key, value);
        return;
      }

      const signatureImageKeys = new Set(
        signatureFieldsForRecipient.map((signatureField) =>
          getSignatureImageFieldKey(signatureField.field)
        )
      );
      if (!signatureImageKeys.has(key)) {
        onChange(key, value);
        return;
      }

      for (const signatureImageKey of signatureImageKeys) {
        onChange(signatureImageKey, value);
      }
    };

    if (isForm && field?.source === "manual") {
      return renderRow(
        blockKey,
        block,
        <div className="space-between flex flex-row">
          <div
            ref={(el) => {
              if (!el || !field) return;
              fieldRefs[field.field] = el;
              for (const signatureField of signatureFieldsForRecipient) {
                fieldRefs[signatureField.field] = el;
              }
            }}
            onClick={() => setSelected(block.field_schema?.field as string)}
            className={`flex-1 cursor-pointer px-1 py-2 transition-all ${isSelected ? "rounded-[0.33em] ring-2 ring-blue-500 ring-offset-2" : ""}`}
            onFocus={() => setSelected(block.field_schema?.field as string)}
          >
            <FieldRenderer
              field={field}
              value={values[field.field]}
              onChange={handleFieldChange}
              onAuxValueChange={handleAuxValueChange}
              onBlur={(nextValue) => onBlurValidate?.(field.field, field, nextValue)}
              error={errors[field.field]}
              allValues={values}
            />
          </div>
        </div>
      );
    }

    if (block.block_type === "header" && block.text_content) {
      const editable = editing?.renderTextBlock?.(block);
      return renderRow(
        blockKey,
        block,
        <div className="flex flex-row">
          {editable ?? <HeaderRenderer content={block.text_content} />}
        </div>
      );
    }

    if (block.block_type === "paragraph" && block.text_content) {
      const editable = editing?.renderTextBlock?.(block);
      return renderRow(
        blockKey,
        block,
        <div className="flex flex-row">
          {editable ?? <ParagraphRenderer content={block.text_content} />}
        </div>
      );
    }

    return <div key={blockKey} />;
  });

  if (editing) {
    return (
      <>
        {editing.renderTopAdder?.()}
        {rows}
      </>
    );
  }
  return rows;
};
