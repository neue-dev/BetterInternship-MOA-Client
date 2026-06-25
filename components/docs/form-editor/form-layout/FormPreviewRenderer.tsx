"use client";

import { useMemo, useRef, useEffect } from "react";
import { type ClientBlock, type ClientField } from "@betterinternship/core/forms";
import { BlocksRenderer, type BlocksRendererEditing } from "@/components/docs/forms/FormFillerRenderer";
import { isBlockField, getBlockField } from "@/components/docs/forms/utils";
import { useFormRendererContext } from "@/components/docs/forms/form-renderer.ctx";
import { useFormFiller } from "@/components/docs/forms/form-filler.ctx";
import { cn } from "@/lib/utils";

interface FormPreviewRendererProps {
  onFieldClick?: (fieldId: string) => void;
  autoScrollToSelectedField?: boolean;
  squareFrame?: boolean;
  editing?: BlocksRendererEditing;
  hideTitle?: boolean;
  selectedPartyId: string;
}

/**
 * Prop-driven adapter over FormFillerRenderer's canonical BlocksRenderer.
 *
 * Reads blocks, values, errors, and selected-field state from the
 * StaticFormRendererContextProvider + FormFillerContextProvider that
 * FormPreviewContent installs, giving the editor preview the same context
 * interface as the live sign route — so future context additions are
 * inherited automatically by both paths.
 *
 * The editing prop (drag handles, inline adders) is passed directly to
 * BlocksRenderer so FormPreviewFormPanel can supply editor chrome without
 * requiring changes to FormFillerRenderer.
 */
export const FormPreviewRenderer = ({
  onFieldClick,
  autoScrollToSelectedField = true,
  squareFrame = false,
  editing,
  hideTitle = false,
  selectedPartyId,
}: FormPreviewRendererProps) => {
  const form = useFormRendererContext();
  const formFiller = useFormFiller();

  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const values = formFiller.getFinalValues();
  const errors = formFiller.errors;
  const selectedFieldId = form.selectedPreviewId;

  // Deduplicate: keep first occurrence of each field ID (same logic as FormFillerRenderer)
  const deduplicatedBlocks = useMemo(() => {
    const seen = new Set<string>();
    return (form.blocks as ClientBlock<any>[]).filter((block) => {
      if (!isBlockField(block)) return true;
      const field = getBlockField(block);
      if (!field) return true;
      if (seen.has(field.field)) return false;
      seen.add(field.field);
      return true;
    });
  }, [form.blocks]);

  const sortedBlocks = useMemo(
    () => [...deduplicatedBlocks].sort((a, b) => a.order - b.order),
    [deduplicatedBlocks]
  );

  useEffect(() => {
    if (!autoScrollToSelectedField || !selectedFieldId || !scrollContainerRef.current) return;
    const element = fieldRefs.current[selectedFieldId];
    if (!element) return;
    const containerRect = scrollContainerRef.current.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const isInView =
      elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;
    if (!isInView) element.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [autoScrollToSelectedField, selectedFieldId]);

  if (!sortedBlocks.length && !editing) {
    return <div className="py-8 text-center text-sm text-slate-500">No blocks to display</div>;
  }

  const handleBlurValidate = (
    fieldKey: string,
    _field: ClientField<any>,
    nextValue?: unknown,
  ) => {
    // Recreate the field with current values as derivationBase so
    // field-relative validators (e.g. dateOnOrAfterField) can read
    // the reference field value via params.
    const currentValues = formFiller.getFinalValues();
    const valuesForParams =
      nextValue === undefined
        ? currentValues
        : {
            ...currentValues,
            [fieldKey]:
              nextValue == null ? "" : String(nextValue),
          };

    const updatedField = form.formMetadata
      .getFieldsForClientService(selectedPartyId, undefined, valuesForParams)
      .find((candidate) => candidate.field === fieldKey);

    formFiller.validateField(fieldKey, updatedField ?? _field, undefined, nextValue);
  };

  return (
    <div
      className={cn(
        "relative flex h-full flex-col border border-gray-300",
        squareFrame ? "rounded-none" : "rounded-[0.33em]"
      )}
    >
      <div ref={scrollContainerRef} className="relative flex flex-1 flex-col overflow-auto">
        {!hideTitle && (
          <div className="px-6 pt-8">
            <h2 className="text-primary text-2xl font-bold">{form.formLabel || form.formName}</h2>
          </div>
        )}
        <div className={cn("flex-1 space-y-2", editing ? "py-4 pr-6 pl-12" : "px-6")}>
          <BlocksRenderer
            formKey={form.formName}
            blocks={sortedBlocks}
            values={values}
            onChange={(key, value) => formFiller.setValue(key, value)}
            errors={errors}
            setSelected={(fieldId) => {
              form.setSelectedPreviewId(fieldId);
              onFieldClick?.(fieldId);
            }}
            onBlurValidate={handleBlurValidate}
            fieldRefs={fieldRefs.current}
            selectedFieldId={selectedFieldId}
            editing={editing}
          />
        </div>
      </div>
    </div>
  );
};
