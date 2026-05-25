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

  // Deduplicate blocks: only keep first instance of each field ID
  const deduplicatedBlocks = useMemo(() => {
    const seenFieldIds = new Set<string>();
    return filteredBlocks.filter((block) => {
      if (!isBlockField(block)) return true; // Always include non-field blocks
      const field = getBlockField(block);
      if (!field) return true;

      if (seenFieldIds.has(field.field)) return false;
      seenFieldIds.add(field.field);
      return true;
    });
  }, [filteredBlocks]);

  const finalValues = useMemo(
    () => formFiller.getFinalValues(autofillValues),
    [formFiller, autofillValues]
  );

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
            values={finalValues}
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
}) => {
  if (!blocks.length) return null;
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

  return sortedBlocks.map((block, i) => {
    const isForm = isBlockField(block);
    const field = isForm ? getBlockField(block) : null;
    const blockKey = `${formKey}:${field?.field || block.block_type}:${i}`;

    // Collapse all blocks in a radio group into a single dropdown
    const radioGroupId = (block.field_schema as any)?.radio_group_id as string | undefined;
    if (radioGroupId) {
      if (renderedRadioGroups.has(radioGroupId)) return null;
      renderedRadioGroups.add(radioGroupId);
      return (
        <div key={`radio-group-${radioGroupId}`}>
          <RadioGroupFiller
            blocks={radioGroupMap.get(radioGroupId)!}
            values={values}
            onChange={onChange}
            errors={errors}
            setSelected={setSelected}
            selectedFieldId={selectedFieldId}
            fieldRefs={fieldRefs}
          />
        </div>
      );
    }

    // Only check selection for form fields
    const isSelected = isForm && field && selectedFieldId === field.field;

    return (
      <div key={blockKey}>
        {isForm && field?.source === "manual" && (
          <div className="space-between flex flex-row">
            <div
              ref={(el) => {
                if (el && field) fieldRefs[field.field] = el;
              }}
              onClick={() => setSelected(block.field_schema?.field as string)}
              className={`flex-1 cursor-pointer px-1 py-2 transition-all ${isSelected ? "rounded-[0.33em] ring-2 ring-blue-500 ring-offset-2" : ""}`}
              onFocus={() => setSelected(block.field_schema?.field as string)}
            >
              <FieldRenderer
                field={field}
                value={values[field.field]}
                onChange={(v) => onChange(field.field, v)}
                onAuxValueChange={onChange}
                onBlur={(nextValue) => onBlurValidate?.(field.field, field, nextValue)}
                error={errors[field.field]}
                allValues={values}
              />
            </div>
          </div>
        )}
        {block.block_type === "header" && block.text_content && (
          <div className="flex flex-row">
            <HeaderRenderer content={block.text_content} />
          </div>
        )}
        {block.block_type === "paragraph" && block.text_content && (
          <div className="flex flex-row">
            <ParagraphRenderer content={block.text_content} />
          </div>
        )}
      </div>
    );
  });
};
