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
type DebugRenderReasons = {
  autofillValues: number;
  blocks: number;
  finalValues: number;
  formFiller: number;
  selectedPreviewId: number;
  sameInputs: number;
};
const FORM_FILLER_DEBUG_PREFIX = "[FormFillerDebug]";
type DebugXMLHttpRequest = XMLHttpRequest & {
  __formFillerDebugRequest?: {
    method: string;
    url: string;
    startedAt: number;
  };
};

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
  const lastScrollLogAtRef = useRef(0);
  const lastLoggedActiveFieldRef = useRef("");
  renderCountRef.current += 1;
  const previousRenderInputsRef = useRef<{
    autofillValues: unknown;
    blocks: unknown;
    finalValues: unknown;
    formFiller: unknown;
    selectedPreviewId: unknown;
  } | null>(null);
  const renderReasonsRef = useRef<DebugRenderReasons>({
    autofillValues: 0,
    blocks: 0,
    finalValues: 0,
    formFiller: 0,
    selectedPreviewId: 0,
    sameInputs: 0,
  });

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

  if (typeof window !== "undefined") {
    const previousInputs = previousRenderInputsRef.current;
    const nextInputs = {
      autofillValues,
      blocks: filteredBlocks,
      finalValues,
      formFiller,
      selectedPreviewId: form.selectedPreviewId,
    };

    if (previousInputs) {
      let changed = false;
      const changedKeys: string[] = [];

      Object.keys(nextInputs).forEach((key) => {
        const typedKey = key as keyof typeof nextInputs;
        if (previousInputs[typedKey] !== nextInputs[typedKey]) {
          renderReasonsRef.current[typedKey] += 1;
          changedKeys.push(key);
          changed = true;
        }
      });

      if (!changed) {
        renderReasonsRef.current.sameInputs += 1;
      }

      console.warn(`${FORM_FILLER_DEBUG_PREFIX} render`, {
        renderCount: renderCountRef.current,
        changed: changedKeys.length ? changedKeys : ["sameInputs"],
        reasons: renderReasonsRef.current,
        selectedPreviewId: form.selectedPreviewId,
        blockCount: filteredBlocks.length,
        manualFieldCount: deduplicatedBlocks.filter((block) => {
          if (!isBlockField(block)) return false;
          return getBlockField(block)?.source === "manual";
        }).length,
      });
    }

    previousRenderInputsRef.current = nextInputs;
  }

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

  const getEventTargetInfo = useCallback((target: EventTarget | null) => {
    const element = target instanceof HTMLElement ? target : null;
    const fieldId =
      element
        ?.closest("[data-form-field-id]")
        ?.getAttribute("data-form-field-id") ?? "";

    return {
      fieldId,
      tag: element?.tagName.toLowerCase() ?? "",
      type: element?.getAttribute("type") ?? "",
      role: element?.getAttribute("role") ?? "",
      id: element?.id ?? "",
      className:
        typeof element?.className === "string"
          ? element.className.slice(0, 160)
          : "",
      text: element?.textContent?.trim().slice(0, 80) ?? "",
    };
  }, []);

  const recordDebugEvent = useCallback(
    (eventType: DebugEventType, fieldId: string) => {
      window.setTimeout(() => {
        const activeInfo = getActiveElementInfo();
        const nextDebugState = {
          eventType,
          fieldId,
          activeInfo,
          renderCount: renderCountRef.current,
          reasons: renderReasonsRef.current,
          selectedPreviewId: form.selectedPreviewId,
        };

        console.warn(`${FORM_FILLER_DEBUG_PREFIX} field-event`, nextDebugState);

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
    [form.selectedPreviewId, getActiveElementInfo]
  );

  useEffect(() => {
    console.warn(`${FORM_FILLER_DEBUG_PREFIX} mounted`, {
      formName: form.formName,
      blockCount: filteredBlocks.length,
      manualFieldCount,
      selectedPreviewId: form.selectedPreviewId,
      autoScrollToSelectedField,
    });
  }, [
    autoScrollToSelectedField,
    filteredBlocks.length,
    form.formName,
    form.selectedPreviewId,
    manualFieldCount,
  ]);

  useEffect(() => {
    console.warn(`${FORM_FILLER_DEBUG_PREFIX} selectedPreviewId`, {
      selectedPreviewId: form.selectedPreviewId,
      selectionTick,
      autoScrollToSelectedField,
      renderCount: renderCountRef.current,
    });
  }, [autoScrollToSelectedField, form.selectedPreviewId, selectionTick]);

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root || typeof window === "undefined") return;

    const logDomEvent = (event: Event) => {
      const activeInfo = getActiveElementInfo();
      const targetInfo = getEventTargetInfo(event.target);

      if (
        event.type === "scroll" &&
        Date.now() - lastScrollLogAtRef.current < 250
      ) {
        return;
      }

      if (event.type === "scroll") {
        lastScrollLogAtRef.current = Date.now();
      }

      console.warn(`${FORM_FILLER_DEBUG_PREFIX} dom-${event.type}`, {
        target: targetInfo,
        active: activeInfo,
        renderCount: renderCountRef.current,
        scrollTop: root.scrollTop,
        selectedPreviewId: form.selectedPreviewId,
      });
    };

    const logActiveElementChange = () => {
      window.setTimeout(() => {
        const activeInfo = getActiveElementInfo();
        if (activeInfo.activeField === lastLoggedActiveFieldRef.current) return;

        lastLoggedActiveFieldRef.current = activeInfo.activeField;
        console.warn(`${FORM_FILLER_DEBUG_PREFIX} active-element`, {
          active: activeInfo,
          renderCount: renderCountRef.current,
          selectedPreviewId: form.selectedPreviewId,
        });
      }, 0);
    };

    const eventNames = [
      "touchstart",
      "touchend",
      "pointerdown",
      "pointerup",
      "mousedown",
      "mouseup",
      "click",
      "focusin",
      "focusout",
      "input",
      "change",
      "keydown",
    ] as const;

    eventNames.forEach((eventName) => {
      root.addEventListener(eventName, logDomEvent, true);
    });
    root.addEventListener("focusin", logActiveElementChange, true);
    root.addEventListener("focusout", logActiveElementChange, true);
    root.addEventListener("scroll", logDomEvent, { passive: true });

    return () => {
      eventNames.forEach((eventName) => {
        root.removeEventListener(eventName, logDomEvent, true);
      });
      root.removeEventListener("focusin", logActiveElementChange, true);
      root.removeEventListener("focusout", logActiveElementChange, true);
      root.removeEventListener("scroll", logDomEvent);
    };
  }, [form.selectedPreviewId, getActiveElementInfo, getEventTargetInfo]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const OriginalXMLHttpRequest = window.XMLHttpRequest;
    const originalOpen = OriginalXMLHttpRequest.prototype.open;
    const originalSend = OriginalXMLHttpRequest.prototype.send;

    OriginalXMLHttpRequest.prototype.open = function (
      this: DebugXMLHttpRequest,
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      this.__formFillerDebugRequest = {
        method,
        url: String(url),
        startedAt: Date.now(),
      };
      return originalOpen.call(this, method, url, async ?? true, username, password);
    } as XMLHttpRequest["open"];

    OriginalXMLHttpRequest.prototype.send = function (
      this: DebugXMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null
    ) {
      const debugRequest = this.__formFillerDebugRequest;

      if (debugRequest?.url.includes("/api/forms/fields")) {
        console.warn(`${FORM_FILLER_DEBUG_PREFIX} xhr-start`, debugRequest);
        this.addEventListener("loadend", () => {
          console.warn(`${FORM_FILLER_DEBUG_PREFIX} xhr-end`, {
            ...debugRequest,
            status: this.status,
            durationMs: Date.now() - debugRequest.startedAt,
            responseText: String(this.responseText ?? "").slice(0, 300),
          });
        });
      }

      return originalSend.call(this, body);
    };

    return () => {
      OriginalXMLHttpRequest.prototype.open = originalOpen;
      OriginalXMLHttpRequest.prototype.send = originalSend;
    };
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
      console.warn(`${FORM_FILLER_DEBUG_PREFIX} scroll-to-selected`, {
        selectedPreviewId: form.selectedPreviewId,
        selectionTick,
        autoScrollToSelectedField,
        fieldTop: fieldElement.getBoundingClientRect().top,
        scrollTop: scrollContainer.scrollTop,
      });

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
              console.warn(`${FORM_FILLER_DEBUG_PREFIX} set-selected`, {
                fieldId,
                viaParent: Boolean(onFieldSelect),
                previousSelectedPreviewId: form.selectedPreviewId,
                renderCount: renderCountRef.current,
              });
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
      <FormFillerDebugOverlay
        blockCount={deduplicatedBlocks.length}
        manualFieldCount={manualFieldCount}
        renderCount={renderCountRef.current}
        renderReasons={renderReasonsRef.current}
        selectedFieldId={form.selectedPreviewId}
        debugState={debugState}
      />
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
                console.warn(`${FORM_FILLER_DEBUG_PREFIX} wrapper-click`, {
                  fieldId: field.field,
                });
                setSelected(field.field);
              }}
              className={`flex-1 cursor-pointer px-1 py-2 transition-all ${isSelected ? "rounded-[0.33em] ring-2 ring-blue-500 ring-offset-2" : ""}`}
              onFocus={() => {
                onDebugEvent?.("focus", field.field);
                console.warn(`${FORM_FILLER_DEBUG_PREFIX} wrapper-focus`, {
                  fieldId: field.field,
                });
                setSelected(field.field);
              }}
            >
              <FieldRenderer
                field={field}
                value={values[field.field]}
                onChange={(v) => {
                  onDebugEvent?.("change", field.field);
                  console.warn(`${FORM_FILLER_DEBUG_PREFIX} value-change`, {
                    fieldId: field.field,
                    fieldType: field.type,
                    valueLength: String(v ?? "").length,
                  });
                  onChange(field.field, v);
                }}
                onAuxValueChange={onChange}
                onBlur={(nextValue) => {
                  onDebugEvent?.("blur", field.field);
                  console.warn(`${FORM_FILLER_DEBUG_PREFIX} value-blur`, {
                    fieldId: field.field,
                    fieldType: field.type,
                    nextValueLength: String(nextValue ?? "").length,
                  });
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
  renderReasons,
  selectedFieldId,
  debugState,
}: {
  blockCount: number;
  manualFieldCount: number;
  renderCount: number;
  renderReasons: DebugRenderReasons;
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
        why b/v/f/a/same: {renderReasons.blocks}/{renderReasons.formFiller}/
        {renderReasons.finalValues}/{renderReasons.autofillValues}/
        {renderReasons.sameInputs}
      </div>
      <div>why selected: {renderReasons.selectedPreviewId}</div>
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
