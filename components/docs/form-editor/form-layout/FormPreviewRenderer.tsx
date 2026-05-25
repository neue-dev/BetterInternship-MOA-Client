"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import z from "zod";
import {
  type IFormBlock,
  type IFormMetadata,
  FormMetadata,
  type ClientBlock,
} from "@betterinternship/core/forms";
import { BlocksRenderer } from "@/components/docs/forms/FormFillerRenderer";
import { isBlockField, getBlockField } from "@/components/docs/forms/utils";
import { cn } from "@/lib/utils";

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
  squareFrame?: boolean;
}

/**
 * Prop-driven adapter over FormFillerRenderer's canonical BlocksRenderer.
 *
 * Converts the raw IFormBlock[] passed by callers into ClientBlock[] so that
 * BlocksRenderer can handle deduplication, radio-group collapsing, and field
 * rendering with compiled validators. Callers pass already party-filtered
 * blocks; we respect that filter by matching on _id.
 *
 * This component owns scroll, the form header, and local validation error
 * state. Full context migration (replacing this with FormFillerRenderer
 * directly) is a follow-on step once callers provide FormFiller context.
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
  squareFrame = false,
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

  // Convert IFormBlock[] → ClientBlock[] so BlocksRenderer can access compiled
  // validators and coerce functions on each field. We call getBlocksForClientService()
  // without a party filter to get all blocks, then restrict to the IDs the caller
  // already party-filtered.
  const clientBlocks = useMemo((): ClientBlock<any>[] => {
    if (!metadataClient) return blocks as unknown as ClientBlock<any>[];
    try {
      const allowedIds = new Set(blocks.map((b) => b._id));
      return (metadataClient.getBlocksForClientService() as ClientBlock<any>[]).filter((cb) =>
        allowedIds.has(cb._id)
      );
    } catch {
      return blocks as unknown as ClientBlock<any>[];
    }
  }, [metadataClient, blocks]);

  // Deduplicate: keep first occurrence of each field ID (same logic as FormFillerRenderer)
  const deduplicatedBlocks = useMemo(() => {
    const seen = new Set<string>();
    return clientBlocks.filter((block) => {
      if (!isBlockField(block)) return true;
      const field = getBlockField(block);
      if (!field) return true;
      if (seen.has(field.field)) return false;
      seen.add(field.field);
      return true;
    });
  }, [clientBlocks]);

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

  const handleBlurValidate = (fieldKey: string, field: any, nextValue?: unknown) => {
    if (!field || !metadataClient || field.source !== "manual") return;
    const nextFieldValue = nextValue === undefined ? values[fieldKey] : String(nextValue ?? "");
    const valuesForParams =
      nextValue === undefined ? values : { ...values, [fieldKey]: nextFieldValue };
    // Re-fetch the field with current params so cross-field validators see up-to-date values.
    const hydratedField =
      metadataClient
        .getFieldsForClientService(undefined, valuesForParams)
        .find((f) => f.field === fieldKey) ?? field;
    const coerced = hydratedField.coerce(nextFieldValue);
    const result = hydratedField.validator?.safeParse(coerced);
    if (result?.error) {
      const errorString = z
        .treeifyError(result.error)
        .errors.map((e: string) => e.split(" ").slice(0).join(" "))
        .join("\n");
      setErrors((prev) => ({ ...prev, [fieldKey]: `${hydratedField.label}: ${errorString}` }));
    } else {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    }
  };

  if (!sortedBlocks.length) {
    return <div className="py-8 text-center text-sm text-slate-500">No blocks to display</div>;
  }

  return (
    <div
      className={cn(
        "relative flex h-full flex-col border border-gray-300",
        squareFrame ? "rounded-none" : "rounded-[0.33em]"
      )}
    >
      <div ref={scrollContainerRef} className="relative flex flex-1 flex-col overflow-auto">
        <div className="px-6 pt-8">
          <h2 className="text-primary text-2xl font-bold">{formLabel || formName}</h2>
        </div>
        <div className="flex-1 space-y-2 px-6">
          <BlocksRenderer
            formKey={formName}
            blocks={sortedBlocks}
            values={values}
            onChange={onChange}
            errors={errors}
            setSelected={(fieldId) => onFieldClick?.(fieldId)}
            onBlurValidate={handleBlurValidate}
            fieldRefs={fieldRefs.current}
            selectedFieldId={selectedFieldId}
          />
        </div>
      </div>
    </div>
  );
};
