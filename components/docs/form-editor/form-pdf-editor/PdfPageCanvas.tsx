"use client";

import { memo, useRef, useState, useEffect } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist/types/src/display/api";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import { cn } from "@/lib/utils";
import { FieldBox, type FormField } from "./FieldBox";
import { RadioGroupOverlay } from "./RadioGroupOverlay";
import { FieldRegistryEntry } from "@/app/api";
import { useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import { useFormEditor } from "@/app/contexts/form-editor.context";
import { IFormBlock, IFormField, IFormMetadata } from "@betterinternship/core/forms";
import { sanitizeFieldSchemaDefaults, type FieldSchemaDefaults } from "@/lib/field-schema-defaults";
import { resolveSystemPresetTemplates } from "@/lib/system-preset-resolver";
import {
  SIGNATURE_PRINTED_NAME_TEMPLATE,
  type CompositeTemplateKey,
} from "@/lib/composite-field-templates";
import {
  createSignaturePrintedNameBlocks,
  resolveSignaturePrintedNameDimensions,
} from "@/lib/composite-block-factory";
import type { ValidatorIRv0 } from "@/lib/validator-ir";
import { computePreviewBaselineOffset } from "@/lib/form-previewer-rendering";
import type { MissingFieldSuggestion } from "@/lib/missing-fields/pipeline";
import { usePdfCoordinateTransform, type PointerLocation } from "./use-pdf-coordinate-transform";
import { RevampedBlockEditor } from "@/components/editor/tab-panels/editor-components/RevampedBlockEditor";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const createUniqueFieldKey = (base: string) =>
  `${base}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const normalizeVerticalAlign = (value: unknown): "top" | "middle" | "bottom" => {
  if (value === "middle" || value === "bottom" || value === "top") return value;
  return "top";
};

export type DraggedFieldPayload = {
  id?: string;
  name: string;
  label?: string;
  type: "text" | "signature" | "image";
  source?: "auto" | "prefill" | "derived" | "manual";
  shared?: boolean;
  tag?: string;
  preset?: string;
  prefiller?: string;
  tooltip_label?: string;
  validator?: string;
  validator_ir?: ValidatorIRv0 | null;
  __palette_source?: "default" | "custom";
  field_schema_defaults?: FieldSchemaDefaults;
  composite_template?: CompositeTemplateKey;
  auto_date_mode?: "default" | "party";
};

export const resolveDroppedFieldKey = (
  field: DraggedFieldPayload,
  selectedPartyId?: string | null
) => {
  const base = field.name || "field";
  if (base === "auto.current-date") {
    return field.auto_date_mode === "party" && selectedPartyId
      ? `auto.current-date:${selectedPartyId}`
      : "auto.current-date:default";
  }
  if (field.__palette_source === "default") {
    return createUniqueFieldKey(base);
  }
  return field.preset ? `${base}:${field.preset}` : base;
};

export const getCompositePresets = (registryRows: FieldRegistryEntry[]) => {
  const presets = resolveSystemPresetTemplates(registryRows);
  return {
    signaturePreset: presets.find((preset) => preset.name === "signature"),
    shortTextPreset: presets.find((preset) => preset.name === "short_text"),
  };
};

export type PdfPageCanvasProps = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  isSelected: boolean;
  _isVisible: boolean;
  onVisible: (page: number) => void;
  registerPageRef: (page: number, node: HTMLDivElement | null) => void;
  blocks: IFormBlock[];
  selectedFieldId: string | null | undefined;
  onFieldSelect: (fieldId: string) => void;
  onBlockUpdate: (block: IFormBlock) => void;
  selectedPartyId: string | null;
  _registry: FieldRegistryEntry[];
  formMetadata: IFormMetadata | null;
  showBaselineGuides: boolean;
  showMissingFieldSuggestions: boolean;
  suggestions: MissingFieldSuggestion[];
  selectedSuggestionId: string | null;
  onSuggestionSelect: (suggestionId: string) => void;
};

export const PdfPageCanvas = memo(
  ({
    pdf,
    pageNumber,
    scale,
    isSelected,
    _isVisible,
    onVisible,
    registerPageRef,
    blocks,
    selectedFieldId,
    onFieldSelect,
    onBlockUpdate,
    selectedPartyId,
    _registry,
    formMetadata,
    showBaselineGuides,
    showMissingFieldSuggestions,
    suggestions,
    selectedSuggestionId,
    onSuggestionSelect,
  }: PdfPageCanvasProps) => {
    const {
      handleBlockCreate,
      handleBlocksCreate,
      handleDeleteBlock,
      handleDuplicateBlock,
      setSelectedBlockId,
      setSelectedFieldId,
    } = useFormEditorTab();
    const { updateBlocks } = useFormEditor();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const viewportRef = useRef<PageViewport | null>(null);
    const [rendering, setRendering] = useState<boolean>(false);
    const [localHover, setLocalHover] = useState<PointerLocation | null>(null);
    const [containerResizeVersion, setContainerResizeVersion] = useState<number>(0);

    useEffect(
      () => registerPageRef(pageNumber, containerRef.current),
      [pageNumber, registerPageRef]
    );

    // Detect when the PDF container changes size (panel resize) and trigger position recalculation
    useEffect(() => {
      const element = containerRef.current;
      if (!element) return;

      const resizeObserver = new ResizeObserver(() => {
        setContainerResizeVersion((prev) => prev + 1);
      });

      resizeObserver.observe(element);
      return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
      const element = containerRef.current;
      if (!element) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) onVisible(pageNumber);
          });
        },
        { threshold: 0.6 }
      );

      observer.observe(element);
      return () => observer.disconnect();
    }, [onVisible, pageNumber]);

    useEffect(() => {
      let renderTask: RenderTask | null = null;
      let cancelled = false;
      setRendering(true);

      pdf
        .getPage(pageNumber)
        .then((page: PDFPageProxy) => {
          if (cancelled) return;
          const viewport = page.getViewport({ scale });
          viewportRef.current = viewport;

          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d");
          if (!canvas || !context) return;

          const outputScale = window.devicePixelRatio || 1;
          canvas.width = viewport.width * outputScale;
          canvas.height = viewport.height * outputScale;
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          const renderContext = {
            canvasContext: context,
            viewport,
            transform: [outputScale, 0, 0, outputScale, 0, 0],
          } as {
            canvasContext: CanvasRenderingContext2D;
            viewport: PageViewport;
            transform: number[];
          };

          renderTask = page.render(renderContext);
          return renderTask.promise;
        })
        .catch((err: any) => {
          const errorObj = err as { name?: string };
          if (errorObj?.name === "RenderingCancelledException") return;
          console.error("Failed to render page", err);
        })
        .finally(() => {
          if (!cancelled) setRendering(false);
        });

      return () => {
        cancelled = true;
        renderTask?.cancel();
      };
    }, [pdf, pageNumber, scale]);

    const { extractLocation, pdfToDisplay, displayDeltaToPdfDelta } = usePdfCoordinateTransform(
      canvasRef,
      viewportRef,
      scale,
      pageNumber
    );

    const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
      const location = extractLocation(event);
      setLocalHover(location);
    };

    const handleMouseLeave = () => {
      setLocalHover(null);
    };

    const handleClick = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
      const location = extractLocation(event);
      if (!location) return;
      setSelectedBlockId(null);
      setSelectedFieldId(null);
    };

    const handleDragOver = (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const fieldData = e.dataTransfer.getData("field");
      if (!fieldData) return;

      try {
        const draggedField = JSON.parse(fieldData) as DraggedFieldPayload;

        console.log("Canvas: Dragged field data:", draggedField);
        console.log("Canvas: Prefiller value:", draggedField.prefiller);

        const location = extractLocation(e);
        if (!location) return;

        if (draggedField.composite_template === SIGNATURE_PRINTED_NAME_TEMPLATE.key) {
          const { signaturePreset, shortTextPreset } = getCompositePresets(_registry);
          const dimensions = resolveSignaturePrintedNameDimensions({
            signaturePreset,
            shortTextPreset,
          });
          const pageWidth = location.viewportWidth / scale;
          const pageHeight = location.viewportHeight / scale;

          const rawX = location.pdfX - dimensions.signatureWidth / 2;
          const rawY = location.pdfY - dimensions.signatureHeight / 2;
          const x = clamp(rawX, 0, Math.max(0, pageWidth - dimensions.signatureWidth));
          const y = clamp(rawY, 0, Math.max(0, pageHeight - dimensions.totalHeight));

          const pairBlocks = createSignaturePrintedNameBlocks({
            partyId: selectedPartyId || "",
            page: pageNumber,
            x,
            y,
            signaturePreset,
            shortTextPreset,
          });
          handleBlocksCreate(pairBlocks);
          return;
        }

        const uniqueId = Math.random().toString(36).substr(2, 9);
        const fieldKey = resolveDroppedFieldKey(draggedField, selectedPartyId);
        const existingForField = blocks.find(
          (block) =>
            block.block_type === "form_field" &&
            block.signing_party_id === (selectedPartyId || "") &&
            block.field_schema?.field === fieldKey
        );
        const baseSchema = existingForField?.field_schema;
        const defaults = sanitizeFieldSchemaDefaults(draggedField.field_schema_defaults);
        const defaultFieldHeightByType = draggedField.type === "signature" ? 25 : 12;
        const fieldWidth = defaults?.w ?? 100;
        const fieldHeight = defaults?.h ?? defaultFieldHeightByType;

        const newBlock: IFormBlock = {
          _id: uniqueId,
          block_type: "form_field",
          signing_party_id: selectedPartyId || "",
          order: 0,
          field_schema: {
            field: fieldKey,
            label: baseSchema?.label || draggedField.label || "New Field",
            tooltip_label: baseSchema?.tooltip_label || draggedField.tooltip_label || "",
            type: baseSchema?.type || draggedField.type,
            page: pageNumber,
            x: location.pdfX - fieldWidth / 2,
            y: location.pdfY - fieldHeight / 2,
            w: baseSchema?.w ?? fieldWidth,
            h: baseSchema?.h ?? fieldHeight,
            align_h: baseSchema?.align_h ?? defaults?.align_h ?? "center",
            align_v: baseSchema?.align_v ?? defaults?.align_v ?? "bottom",
            shared:
              typeof baseSchema?.shared === "boolean"
                ? baseSchema.shared
                : (draggedField.shared ?? true),
            source: (baseSchema?.source || draggedField.source || "manual") as IFormField["source"],
            ...(baseSchema?.prefiller
              ? { prefiller: baseSchema.prefiller }
              : draggedField.prefiller
                ? { prefiller: draggedField.prefiller }
                : {}),
            ...(baseSchema?.validator
              ? { validator: baseSchema.validator }
              : draggedField.validator
                ? { validator: draggedField.validator }
                : {}),
            ...(baseSchema?.validator_ir
              ? { validator_ir: baseSchema.validator_ir }
              : draggedField.validator_ir
                ? { validator_ir: draggedField.validator_ir }
                : {}),
            ...(baseSchema?.size
              ? { size: baseSchema.size }
              : defaults?.size
                ? { size: defaults.size }
                : {}),
            ...(typeof baseSchema?.wrap === "boolean"
              ? { wrap: baseSchema.wrap }
              : typeof defaults?.wrap === "boolean"
                ? { wrap: defaults.wrap }
                : { wrap: true }),
            ...(baseSchema?.font
              ? { font: baseSchema.font }
              : defaults?.font
                ? { font: defaults.font }
                : {}),
          },
        };

        // Inject radio group metadata when dropping a radio option preset
        if (draggedField.validator_ir?.baseType === "radio" && newBlock.field_schema) {
          const radioGroupId = `rg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          newBlock.field_schema = {
            ...newBlock.field_schema,
            radio_group_id: radioGroupId,
            radio_option_label: "Option 1",
          };
        }

        console.log("Canvas: Created block field_schema:", newBlock.field_schema);
        handleBlockCreate(newBlock);
      } catch (err) {
        console.error("Error dropping field:", err);
      }
    };

    const handleFieldDrag = (fieldId: string, displayDeltaX: number, displayDeltaY: number) => {
      const { pdfDeltaX, pdfDeltaY } = displayDeltaToPdfDelta(displayDeltaX, displayDeltaY);
      const block = blocks.find((b) => b._id === fieldId);
      if (!block || !block.field_schema) {
        console.warn("handleFieldDrag: block or field_schema not found", {
          fieldId,
          availableFields: blocks.map((b) => ({ id: b._id, label: b.field_schema?.label })),
        });
        return;
      }

      const newX = Math.max(0, block.field_schema.x + pdfDeltaX);
      const newY = Math.max(0, block.field_schema.y + pdfDeltaY);

      const updatedBlock: IFormBlock = {
        ...block,
        field_schema: {
          ...block.field_schema,
          x: newX,
          y: newY,
        },
      };
      onBlockUpdate(updatedBlock);
    };

    const handleFieldResize = (
      fieldId: string,
      handle: "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se",
      displayDeltaX: number,
      displayDeltaY: number
    ) => {
      const { pdfDeltaX, pdfDeltaY } = displayDeltaToPdfDelta(displayDeltaX, displayDeltaY);
      const block = blocks.find((b) => b._id === fieldId);
      if (!block || !block.field_schema) return;

      const minSize = 10;
      const fieldSchema = block.field_schema;

      let newX = fieldSchema.x;
      let newY = fieldSchema.y;
      let newW = fieldSchema.w;
      let newH = fieldSchema.h;

      if (handle === "n") {
        newY = Math.max(0, fieldSchema.y + pdfDeltaY);
        newH = Math.max(minSize, fieldSchema.h - pdfDeltaY);
      } else if (handle === "e") {
        newW = Math.max(minSize, fieldSchema.w + pdfDeltaX);
      } else if (handle === "s") {
        newH = Math.max(minSize, fieldSchema.h + pdfDeltaY);
      } else if (handle === "w") {
        newX = Math.max(0, fieldSchema.x + pdfDeltaX);
        newW = Math.max(minSize, fieldSchema.w - pdfDeltaX);
      } else if (handle === "nw") {
        newX = Math.max(0, fieldSchema.x + pdfDeltaX);
        newY = Math.max(0, fieldSchema.y + pdfDeltaY);
        newW = Math.max(minSize, fieldSchema.w - pdfDeltaX);
        newH = Math.max(minSize, fieldSchema.h - pdfDeltaY);
      } else if (handle === "ne") {
        newY = Math.max(0, fieldSchema.y + pdfDeltaY);
        newW = Math.max(minSize, fieldSchema.w + pdfDeltaX);
        newH = Math.max(minSize, fieldSchema.h - pdfDeltaY);
      } else if (handle === "sw") {
        newX = Math.max(0, fieldSchema.x + pdfDeltaX);
        newW = Math.max(minSize, fieldSchema.w - pdfDeltaX);
        newH = Math.max(minSize, fieldSchema.h + pdfDeltaY);
      } else if (handle === "se") {
        newW = Math.max(minSize, fieldSchema.w + pdfDeltaX);
        newH = Math.max(minSize, fieldSchema.h + pdfDeltaY);
      }

      const updatedBlock: IFormBlock = {
        ...block,
        field_schema: {
          ...fieldSchema,
          x: newX,
          y: newY,
          w: newW,
          h: newH,
        },
      };
      onBlockUpdate(updatedBlock);
    };

    const handleFieldRecipientChange = (fieldId: string, partyId: string) => {
      const block = blocks.find((b) => b._id === fieldId);
      if (!block) return;
      const radioGroupId = block.field_schema?.radio_group_id as string | undefined;
      if (radioGroupId) {
        const updatedBlocks = blocks.map((b) => {
          if (b.block_type !== "form_field" || b.field_schema?.radio_group_id !== radioGroupId)
            return b;
          return { ...b, signing_party_id: partyId };
        });
        updateBlocks(updatedBlocks);
      } else {
        onBlockUpdate({ ...block, signing_party_id: partyId });
      }
    };

    const findSameFieldIds = (fieldId: string): string[] => {
      const target = blocks.find((b) => b._id === fieldId);
      const fieldName = target?.field_schema?.field;
      if (!fieldName) return [fieldId];
      return blocks
        .filter((b) => b.block_type === "form_field" && b.field_schema?.field === fieldName)
        .sort((a, b) => {
          const aPage = a.field_schema?.page || 0;
          const bPage = b.field_schema?.page || 0;
          if (aPage !== bPage) return aPage - bPage;
          return (a.order || 0) - (b.order || 0);
        })
        .map((b) => b._id);
    };

    const selectSameFieldAtIndex = (ids: string[], index: number) => {
      const targetId = ids[index];
      if (!targetId) return;
      const targetBlock = blocks.find((b) => b._id === targetId);
      const targetPage = targetBlock?.field_schema?.page;
      if (typeof targetPage === "number" && targetPage > 0) {
        onVisible(targetPage);
      }
      onFieldSelect(targetId);
    };

    const handleSelectNextSameField = (fieldId: string) => {
      const ids = findSameFieldIds(fieldId);
      if (ids.length <= 1) return;
      const idx = ids.indexOf(fieldId);
      const nextIndex = (idx + 1 + ids.length) % ids.length;
      selectSameFieldAtIndex(ids, nextIndex);
    };

    const handleSelectPrevSameField = (fieldId: string) => {
      const ids = findSameFieldIds(fieldId);
      if (ids.length <= 1) return;
      const idx = ids.indexOf(fieldId);
      const prevIndex = (idx - 1 + ids.length) % ids.length;
      selectSameFieldAtIndex(ids, prevIndex);
    };

    const handleAddRadioOption = (groupId: string) => {
      const groupBlocks = blocks.filter(
        (b) => b.block_type === "form_field" && b.field_schema?.radio_group_id === groupId
      );
      if (!groupBlocks.length) return;

      const rightmost = groupBlocks.reduce((best, b) => {
        const s = b.field_schema!;
        const bestS = best.field_schema!;
        return s.x + s.w > bestS.x + bestS.w ? b : best;
      });
      const schema = rightmost.field_schema!;
      const optionNumber = groupBlocks.length + 1;
      const newFieldKey = `radio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const newBlock: IFormBlock = {
        _id: `block-radio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        block_type: "form_field",
        signing_party_id: rightmost.signing_party_id,
        order: blocks.length,
        field_schema: {
          field: newFieldKey,
          type: "text",
          page: schema.page,
          x: schema.x + schema.w + 4,
          y: schema.y,
          w: schema.w,
          h: schema.h,
          align_h: schema.align_h ?? "center",
          align_v: schema.align_v ?? "middle",
          label: `Option ${optionNumber}`,
          tooltip_label: "",
          shared: schema.shared,
          source: schema.source,
          prefiller: schema.prefiller,
          validator: schema.validator,
          validator_ir: schema.validator_ir,
          size: schema.size,
          wrap: schema.wrap,
          font: schema.font,
          radio_group_id: groupId,
          radio_option_label: `Option ${optionNumber}`,
        },
      };

      handleBlockCreate(newBlock);
    };

    const [activeGroupDrag, setActiveGroupDrag] = useState<{
      groupId: string;
      x: number;
      y: number;
    } | null>(null);

    const handleGroupDragMove = (groupId: string, displayDeltaX: number, displayDeltaY: number) => {
      setActiveGroupDrag({ groupId, x: displayDeltaX, y: displayDeltaY });
    };

    const handleGroupDragEnd = (groupId: string, displayDeltaX: number, displayDeltaY: number) => {
      setActiveGroupDrag(null);
      const { pdfDeltaX, pdfDeltaY } = displayDeltaToPdfDelta(displayDeltaX, displayDeltaY);
      const nextBlocks = blocks.map((b) => {
        if (b.block_type !== "form_field") return b;
        if (b.field_schema?.radio_group_id !== groupId) return b;
        const schema = b.field_schema!;
        return {
          ...b,
          field_schema: {
            ...schema,
            x: Math.max(0, schema.x + pdfDeltaX),
            y: Math.max(0, schema.y + pdfDeltaY),
          },
        };
      });
      updateBlocks(nextBlocks);

      const firstGroupBlock = blocks
        .filter((b) => b.block_type === "form_field" && b.field_schema?.radio_group_id === groupId)
        .sort((a, b) => (a.field_schema?.x ?? 0) - (b.field_schema?.x ?? 0))[0];
      if (firstGroupBlock) onFieldSelect(firstGroupBlock._id);
    };

    return (
      <div
        ref={containerRef}
        data-page={pageNumber}
        className={cn(
          "relative w-fit max-w-none overflow-visible rounded-[0.33em] border bg-white shadow-sm transition-colors",
          isSelected ? "border-primary/80 ring-primary/50 ring-1" : "border-border"
        )}
      >
        <div className="text-muted-foreground flex items-center justify-between border-b px-3 py-2 text-xs">
          <span>Page {pageNumber}</span>
          {localHover ? (
            <span className="text-[11px]">
              x={localHover.pdfX.toFixed(2)}, y={localHover.pdfY.toFixed(2)}
            </span>
          ) : null}
        </div>
        <div className="relative flex justify-center bg-slate-50">
          <canvas
            ref={canvasRef}
            className="block"
            style={{ cursor: "pointer" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
          {rendering && (
            <div className="text-muted-foreground absolute inset-0 flex items-center justify-center bg-white/70 text-xs">
              Rendering...
            </div>
          )}

          {/* Radio group bounding boxes — rendered BEFORE field boxes so field boxes (same z-10, later in DOM) paint on top and receive interior events */}
          <RadioGroupOverlay
            blocks={blocks.filter(
              (b) => b.block_type === "form_field" && b.field_schema?.page === pageNumber
            )}
            pdfToDisplay={pdfToDisplay}
            scale={scale}
            onAddOption={handleAddRadioOption}
            onGroupDragMove={handleGroupDragMove}
            onGroupDragEnd={handleGroupDragEnd}
            onGroupClick={(groupId) => {
              const firstBlock = blocks
                .filter(
                  (b) => b.block_type === "form_field" && b.field_schema?.radio_group_id === groupId
                )
                .sort((a, b) => (a.field_schema?.x ?? 0) - (b.field_schema?.x ?? 0))[0];
              if (firstBlock) onFieldSelect(firstBlock._id);
            }}
            activeDrag={activeGroupDrag}
          />

          {/* Render form fields */}
          <div className="pointer-events-none absolute inset-0 z-10" key={containerResizeVersion}>
            {blocks.map((block) => {
              const schema = block.field_schema;
              if (!schema || schema.page !== pageNumber || block.block_type !== "form_field")
                return null;

              const fieldId = block._id;
              const pos = pdfToDisplay(schema.x, schema.y);
              if (!pos) return null;

              const field: FormField = {
                id: fieldId,
                field: schema.field,
                label: schema.label,
                tooltip_label: schema.tooltip_label || "",
                type: schema.type,
                page: schema.page,
                x: schema.x,
                y: schema.y,
                w: schema.w,
                h: schema.h,
                signing_party_id: block.signing_party_id,
                signing_party_order:
                  formMetadata?.signing_parties?.find((p) => p._id === block.signing_party_id)
                    ?.order ?? 0,
                size: schema.size,
                font: schema.font,
                align_v: normalizeVerticalAlign(schema.align_v),
                wrap: schema.wrap,
              };

              const baselineOffsetDoc = computePreviewBaselineOffset({
                fieldType: schema.type,
                fieldFont: schema.font,
                fontSize: schema.size,
                fieldHeight: schema.h,
                alignV: normalizeVerticalAlign(schema.align_v),
              });
              const baselineOffsetPx = baselineOffsetDoc * scale;

              const sameFieldIds = findSameFieldIds(fieldId);
              const sameFieldIndex = Math.max(0, sameFieldIds.indexOf(fieldId)) + 1;

              const fieldGroupId = schema?.radio_group_id as string | undefined;
              const isGroupDragging = !!fieldGroupId && activeGroupDrag?.groupId === fieldGroupId;
              const groupDragX = isGroupDragging ? activeGroupDrag!.x : 0;
              const groupDragY = isGroupDragging ? activeGroupDrag!.y : 0;

              const isFieldSelected = selectedFieldId === fieldId;
              return (
                <div
                  key={fieldId}
                  data-field-id={fieldId}
                  className={isFieldSelected ? "pointer-events-auto relative z-[100]" : "pointer-events-auto relative z-20"}
                  style={{
                    position: "absolute",
                    left: `${pos.displayX}px`,
                    top: `${pos.displayY}px`,
                    width: `${schema.w * scale}px`,
                    height: `${schema.h * scale}px`,
                    transform: isGroupDragging
                      ? `translate(${groupDragX}px, ${groupDragY}px)`
                      : undefined,
                    pointerEvents: isGroupDragging ? "none" : undefined,
                  }}
                >
                  <FieldBox
                    field={field}
                    isSelected={isFieldSelected}
                    onSelect={() => {
                      onFieldSelect?.(fieldId);
                    }}
                    settingsContent={isFieldSelected ? <RevampedBlockEditor /> : undefined}
                    onDrag={(deltaX, deltaY) => handleFieldDrag(fieldId, deltaX, deltaY)}
                    onDragEnd={() => {}}
                    onResize={(handle, deltaX, deltaY) =>
                      handleFieldResize(fieldId, handle, deltaX, deltaY)
                    }
                    onResizeEnd={() => {}}
                    signingPartyOptions={(formMetadata?.signing_parties || []).map((party) => ({
                      id: party._id,
                      name: party.signatory_title || party._id,
                    }))}
                    onSigningPartyChange={(partyId) => handleFieldRecipientChange(fieldId, partyId)}
                    onDelete={() => handleDeleteBlock(fieldId)}
                    onDuplicate={() => {
                      const block = blocks.find((b) => b._id === fieldId);
                      if (!block) return;
                      const radioGroupId = block.field_schema?.radio_group_id;
                      if (radioGroupId) {
                        const groupBlocks = blocks.filter(
                          (b) =>
                            b.block_type === "form_field" &&
                            b.field_schema?.radio_group_id === radioGroupId
                        );
                        const newGroupId = `rg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                        const OFFSET = 8;
                        const now = Date.now();
                        const newBlocks: IFormBlock[] = groupBlocks.map((gb, i) => ({
                          ...gb,
                          _id: `block_${now}_${i}_${Math.random().toString(36).substr(2, 6)}`,
                          field_schema: gb.field_schema
                            ? {
                                ...gb.field_schema,
                                field: `radio_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
                                y: (gb.field_schema.y ?? 0) + OFFSET,
                                radio_group_id: newGroupId,
                              }
                            : gb.field_schema,
                        }));
                        handleBlocksCreate(newBlocks);
                      } else {
                        handleDuplicateBlock(block);
                      }
                    }}
                    sameFieldIndex={sameFieldIndex}
                    sameFieldCount={sameFieldIds.length}
                    onPrevSameField={() => handleSelectPrevSameField(fieldId)}
                    onNextSameField={() => handleSelectNextSameField(fieldId)}
                    showBaselineGuide={showBaselineGuides}
                    baselineGuideOffsetPx={baselineOffsetPx}
                    showInlineDelete={!!schema.radio_group_id}
                    onInlineDelete={() => handleDeleteBlock(fieldId)}
                    onDeselect={() => {
                      setSelectedFieldId(null);
                      setSelectedBlockId(null);
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Crosshair overlay on hover */}
          {localHover && (
            <div className="pointer-events-none absolute inset-0">
              <div
                className="bg-primary/50 absolute h-full w-px"
                style={{ left: `${localHover.displayX}px` }}
              />
              <div
                className="border-primary/50 absolute w-full border-t"
                style={{ top: `${localHover.displayY}px` }}
              />
            </div>
          )}

          {showMissingFieldSuggestions
            ? suggestions
                .filter((suggestion) => suggestion.page === pageNumber)
                .map((suggestion) => {
                  const suggestionPosition = pdfToDisplay(suggestion.x, suggestion.y);
                  if (!suggestionPosition) return null;
                  const isSelected = selectedSuggestionId === suggestion.id;
                  return (
                    <button
                      key={suggestion.id}
                      type="button"
                      className={cn(
                        "absolute z-30 border-2 transition-colors",
                        isSelected
                          ? "border-slate-600 bg-slate-300/20"
                          : "border-slate-400/80 bg-slate-300/10 hover:bg-slate-300/15"
                      )}
                      style={{
                        left: `${suggestionPosition.displayX}px`,
                        top: `${suggestionPosition.displayY}px`,
                        width: `${suggestion.w * scale}px`,
                        height: `${suggestion.h * scale}px`,
                        backgroundImage:
                          "repeating-linear-gradient(135deg, rgba(71,85,105,0.12) 0px, rgba(71,85,105,0.12) 6px, transparent 6px, transparent 12px)",
                      }}
                      title={`Suggested field: ${suggestion.inferredLabel}`}
                      onClick={() => onSuggestionSelect(suggestion.id)}
                    />
                  );
                })
            : null}
        </div>
      </div>
    );
  }
);
PdfPageCanvas.displayName = "PdfPageCanvas";
