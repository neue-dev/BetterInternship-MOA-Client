"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { type IFormBlock, type IFormMetadata, FormMetadata } from "@betterinternship/core/forms";
import { FieldRenderer } from "@/components/docs/forms/FieldRenderer";
import { HeaderRenderer, ParagraphRenderer } from "@/components/docs/forms/BlockrRenderer";
import { getBlockField, isBlockField } from "@/components/docs/forms/utils";

interface FormPreviewRendererProps {
  formName: string;
  formLabel: string;
  blocks: IFormBlock[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  metadata?: IFormMetadata;
  selectedFieldId?: string | null;
  onFieldClick?: (fieldId: string) => void;
  autoScrollToSelectedField?: boolean;
}

/**
 * Simple form preview renderer that replicates FormFillerRenderer
 * but without context, validation, or autofill dependencies
 *
 * // ! todo: use contexts to access field and block data instead of passing them in
 * // ! todo: use ClientField and ClientBlock instead of IFormField and IFormBlock
 */
export const FormPreviewRenderer = ({
  formName,
  formLabel,
  blocks,
  values,
  onChange,
  metadata,
  selectedFieldId,
  onFieldClick,
  autoScrollToSelectedField = true,
}: FormPreviewRendererProps) => {
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const metadataClient = useMemo(() => {
    if (!metadata) return null;
    try {
      return new FormMetadata(metadata);
    } catch {
      return null;
    }
  }, [metadata]);

  // Extract actual fields from metadata for proper validation and field types
  const metadataFields = useMemo(() => {
    if (!metadataClient) return [];
    return metadataClient.getFieldsForClientService();
  }, [metadataClient]);

  // Create a map of field name to field object for easy lookup
  const fieldMap = useMemo(() => {
    const map = new Map();
    metadataFields.forEach((field) => {
      map.set(field.field, field);
    });
    return map;
  }, [metadataFields]);

  // Deduplicate blocks: only keep first instance of each field ID
  const deduplicatedBlocks = useMemo(() => {
    const seenFieldIds = new Set<string>();
    return blocks.filter((block) => {
      if (!isBlockField(block)) return true; // Always include non-field blocks
      const field = getBlockField(block);
      if (!field) return true;

      // Only include if this is the first time we see this field ID
      if (seenFieldIds.has(field.field)) return false;
      seenFieldIds.add(field.field);
      return true;
    });
  }, [blocks]);

  // Use values prop directly without merging with local state
  // Parent component handles initialization
  const displayValues = useMemo(() => {
    return values;
  }, [values]);

  // Scroll to selected field only when requested (e.g. selection came from PDF).
  useEffect(() => {
    if (!autoScrollToSelectedField || !selectedFieldId || !scrollContainerRef.current) return;
    const element = fieldRefs.current[selectedFieldId];
    if (!element) return;

    const containerRect = scrollContainerRef.current.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const isVisible =
      elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;

    if (!isVisible) {
      element.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [autoScrollToSelectedField, selectedFieldId]);

  const handleChange = (key: string, value: string) => {
    onChange(key, value);
  };

  const sortedBlocks = useMemo(
    () => [...deduplicatedBlocks].sort((a, b) => a.order - b.order),
    [deduplicatedBlocks]
  );

  if (!sortedBlocks.length) {
    return <div className="py-8 text-center text-sm text-slate-500">No blocks to display</div>;
  }

  const handleBlurValidate = (fieldKey: string, nextValue?: unknown) => {
    const currentField = fieldMap.get(fieldKey);
    if (!currentField || currentField.source !== "manual") return;

    const nextFieldValue = nextValue === undefined ? displayValues[fieldKey] : String(nextValue ?? "");
    const valuesForParams: Record<string, string> =
      nextValue === undefined
        ? displayValues
        : {
            ...displayValues,
            [fieldKey]: nextFieldValue,
          };

    // Rebuild fields using merged params so cross-field validators can see latest values.
    const hydratedField =
      metadataClient
        ?.getFieldsForClientService(undefined, valuesForParams)
        .find((field) => field.field === fieldKey) || currentField;

    const coerced = hydratedField.coerce(nextFieldValue);
    const result = hydratedField.validator?.safeParse(coerced);

    if (result?.error) {
      // ! todo: import zod at the top, not here (dynamic imports bad)
      // ! todo: import zod at the top, not here (dynamic imports bad)
      const z = require("zod");
      const errorString = z
        .treeifyError(result.error)
        .errors.map((e: string) => e.split(" ").slice(0).join(" "))
        .join("\n");
      setErrors((prev) => ({
        ...prev,
        [fieldKey]: `${hydratedField.label}: ${errorString}`,
      }));
    } else {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }
  };

  return (
    <div className="relative flex h-full flex-col rounded-[0.33em] border border-gray-300">
      <div ref={scrollContainerRef} className="relative flex flex-1 flex-col overflow-auto">
        <div className="px-7 py-5">
          <h2 className="text-primary text-2xl font-bold">{formLabel || formName}</h2>
        </div>
        <div className="mt-7 flex-1 space-y-2 border-r border-gray-300 px-7">
          <BlocksRenderer
            formKey={formName}
            blocks={sortedBlocks}
            values={displayValues}
            onChange={handleChange}
            errors={errors}
            onBlurValidate={handleBlurValidate}
            fieldRefs={fieldRefs.current}
            fieldMap={fieldMap}
            selectedFieldId={selectedFieldId}
            onFieldClick={onFieldClick}
          />
        </div>
      </div>
    </div>
  );
};

const BlocksRenderer = ({
  formKey,
  blocks,
  values,
  onChange,
  errors,
  onBlurValidate,
  fieldRefs,
  fieldMap,
  selectedFieldId,
  onFieldClick,
}: {
  formKey: string;
  // ! TODO: make this use ClientBlock<[any]>[] instead of IFormBlock[]
  // ! TODO: make this use ClientBlock<[any]>[] instead of IFormBlock[]
  blocks: IFormBlock[];
  values: Record<string, string>;
  onChange: (key: string, value: any) => void;
  errors: Record<string, string>;
  onBlurValidate?: (fieldKey: string, nextValue?: unknown) => void;
  fieldRefs: Record<string, HTMLDivElement | null>;
  fieldMap: Map<string, any>;
  selectedFieldId?: string | null;
  onFieldClick?: (fieldId: string) => void;
}) => {
  if (!blocks.length) return null;

  return blocks.map((block, i) => {
    const isForm = isBlockField(block);
    const blockField = isForm ? getBlockField(block) : null;

    // Get the actual field from metadata (has validators and proper type info)
    const metadataField = blockField ? fieldMap.get(blockField.field) : null;

    return (
      <>
        {isForm && blockField?.source === "manual" && metadataField && (
          <div className="space-between flex flex-row" key={`${formKey}:${i}`}>
            <div
              ref={(el) => {
                if (el && blockField) fieldRefs[blockField.field] = el;
              }}
              onClick={() => {
                if (blockField) onFieldClick?.(blockField.field);
              }}
              className={`flex-1 cursor-pointer px-1 py-2 transition-all ${
                blockField && selectedFieldId === blockField.field
                  ? "rounded-[0.33em] ring-2 ring-blue-500 ring-offset-2"
                  : ""
              }`}
              onFocus={() => {
                if (blockField) onFieldClick?.(blockField.field);
              }}
            >
              <FieldRenderer
                field={metadataField}
                value={values[blockField.field] ?? ""}
                onChange={(v) => onChange(blockField.field, v)}
                onAuxValueChange={onChange}
                onBlur={(nextValue) => onBlurValidate?.(blockField.field, nextValue)}
                error={errors[blockField.field]}
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
      </>
    );
  });
};
