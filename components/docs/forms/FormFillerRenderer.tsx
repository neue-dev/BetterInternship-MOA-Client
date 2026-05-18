"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClientBlock } from "@betterinternship/core/forms";
import { FieldRenderer } from "./FieldRenderer";
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

type DebugEventType = "click" | "focus" | "change" | "blur";

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
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  const debugEnabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debug-form-filler");
  const [debugState, setDebugState] = useState({
    lastEvent: "init",
    lastField: "",
    clickCount: 0,
    focusCount: 0,
    changeCount: 0,
    blurCount: 0,
    activeField: "",
    activeElement: "",
    rendersAtLastEvent: 0,
  });

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

  const manualFieldCount = useMemo(
    () =>
      deduplicatedBlocks.filter((block) => {
        if (!isBlockField(block)) return false;
        return getBlockField(block)?.source === "manual";
      }).length,
    [deduplicatedBlocks]
  );

  const getActiveElementInfo = useCallback(() => {
    if (typeof document === "undefined") {
      return { activeField: "", activeElement: "" };
    }

    const activeElement = document.activeElement as HTMLElement | null;
    const activeField =
      activeElement
        ?.closest("[data-form-field-id]")
        ?.getAttribute("data-form-field-id") ?? "";
    const activeElementLabel = activeElement
      ? [
          activeElement.tagName.toLowerCase(),
          activeElement.getAttribute("type"),
          activeElement.getAttribute("role"),
        ]
          .filter(Boolean)
          .join(":")
      : "";

    return { activeField, activeElement: activeElementLabel };
  }, []);

  const recordDebugEvent = useCallback(
    (eventType: DebugEventType, fieldId: string) => {
      if (!debugEnabled) return;

      window.setTimeout(() => {
        const activeInfo = getActiveElementInfo();

        setDebugState((prev) => ({
          ...prev,
          lastEvent: eventType,
          lastField: fieldId,
          clickCount: prev.clickCount + (eventType === "click" ? 1 : 0),
          focusCount: prev.focusCount + (eventType === "focus" ? 1 : 0),
          changeCount: prev.changeCount + (eventType === "change" ? 1 : 0),
          blurCount: prev.blurCount + (eventType === "blur" ? 1 : 0),
          activeField: activeInfo.activeField,
          activeElement: activeInfo.activeElement,
          rendersAtLastEvent: renderCountRef.current,
        }));
      }, 0);
    },
    [debugEnabled, getActiveElementInfo]
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
            onDebugEvent={recordDebugEvent}
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
      {debugEnabled && (
        <FormFillerDebugOverlay
          blockCount={deduplicatedBlocks.length}
          manualFieldCount={manualFieldCount}
          renderCount={renderCountRef.current}
          selectedFieldId={form.selectedPreviewId}
          debugState={debugState}
        />
      )}
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
  onDebugEvent,
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
  onDebugEvent?: (eventType: DebugEventType, fieldId: string) => void;
  setSelected: (selected: string) => void;
  onBlurValidate?: (fieldKey: string, field: any, nextValue?: unknown) => void;
  fieldRefs: Record<string, HTMLDivElement | null>;
  selectedFieldId?: string | null;
}) => {
  if (!blocks.length) return null;
  const sortedBlocks = blocks.toSorted((a, b) => a.order - b.order);
  return sortedBlocks.map((block, i) => {
    const isForm = isBlockField(block);
    const field = isForm ? getBlockField(block) : null;
    const blockKey = `${formKey}:${field?.field || block.block_type}:${i}`;

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
              data-form-field-id={field.field}
              onClick={() => {
                onDebugEvent?.("click", field.field);
                setSelected(field.field);
              }}
              className={`flex-1 cursor-pointer px-1 py-2 transition-all ${isSelected ? "rounded-[0.33em] ring-2 ring-blue-500 ring-offset-2" : ""}`}
              onFocus={() => {
                onDebugEvent?.("focus", field.field);
                setSelected(field.field);
              }}
            >
              <FieldRenderer
                field={field}
                value={values[field.field]}
                onChange={(v) => {
                  onDebugEvent?.("change", field.field);
                  onChange(field.field, v);
                }}
                onAuxValueChange={onChange}
                onBlur={(nextValue) => {
                  onDebugEvent?.("blur", field.field);
                  onBlurValidate?.(field.field, field, nextValue);
                }}
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

const FormFillerDebugOverlay = ({
  blockCount,
  manualFieldCount,
  renderCount,
  selectedFieldId,
  debugState,
}: {
  blockCount: number;
  manualFieldCount: number;
  renderCount: number;
  selectedFieldId?: string | null;
  debugState: {
    lastEvent: string;
    lastField: string;
    clickCount: number;
    focusCount: number;
    changeCount: number;
    blurCount: number;
    activeField: string;
    activeElement: string;
    rendersAtLastEvent: number;
  };
}) => {
  const rendersSinceEvent = renderCount - debugState.rendersAtLastEvent;

  return (
    <div className="fixed bottom-3 left-3 z-[99999] max-w-[calc(100vw-1.5rem)] rounded-[0.33em] bg-slate-950/90 px-3 py-2 font-mono text-[10px] leading-4 text-white shadow-xl">
      <div>Form debug</div>
      <div>
        renders: {renderCount} (+{rendersSinceEvent})
      </div>
      <div>
        fields: {manualFieldCount} / blocks: {blockCount}
      </div>
      <div>
        events c/f/ch/b: {debugState.clickCount}/{debugState.focusCount}/
        {debugState.changeCount}/{debugState.blurCount}
      </div>
      <div>last: {debugState.lastEvent}</div>
      <div className="truncate">field: {debugState.lastField || "-"}</div>
      <div className="truncate">active: {debugState.activeField || "-"}</div>
      <div>element: {debugState.activeElement || "-"}</div>
      <div className="truncate">selected: {selectedFieldId || "-"}</div>
    </div>
  );
};
