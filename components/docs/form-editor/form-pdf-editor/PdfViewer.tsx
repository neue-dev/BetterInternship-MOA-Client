"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import { GlobalWorkerOptions, version as pdfjsVersion } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { ZoomIn, ZoomOut, FileUp, SlidersHorizontal } from "lucide-react";
import { useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import { useFormEditor } from "@/app/contexts/form-editor.context";
import { usePdfViewer } from "@/app/contexts/pdf-viewer.context";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IFormBlock, IFormField } from "@betterinternship/core/forms";
import { FormViewBlocksPanel } from "@/components/editor/tab-panels/editor-components/FormViewBlocksPanel";
import { sanitizeFieldSchemaDefaults } from "@/lib/field-schema-defaults";
import { resolveSystemPresetTemplates } from "@/lib/system-preset-resolver";
import { SIGNATURE_PRINTED_NAME_TEMPLATE } from "@/lib/composite-field-templates";
import {
  createSignaturePrintedNameBlocks,
  resolveSignaturePrintedNameDimensions,
} from "@/lib/composite-block-factory";
import {
  computePreviewBaselineOffset,
  ensurePreviewFontsLoaded,
} from "@/lib/form-previewer-rendering";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import {
  getDetectedRegionBaselineY,
  runMissingFieldPipeline,
  type MissingFieldSuggestion,
} from "@/lib/missing-fields/pipeline";
import { createBlockFromSuggestionWithPreset } from "@/lib/missing-fields/presets";
import { classifyBlankRegionsAgainstBlocks } from "@/lib/missing-fields/compare";
import { toExistingFieldRects } from "@/lib/missing-fields/types";
import { useFieldTemplateContext } from "@/app/contexts/field-template.ctx";
import {
  PdfPageCanvas,
  type DraggedFieldPayload,
  resolveDroppedFieldKey,
  getCompositePresets,
} from "./PdfPageCanvas";
import { RecipientTabBar } from "@/components/docs/form-editor/RecipientTabBar";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizeVerticalAlign = (value: unknown): "top" | "middle" | "bottom" => {
  if (value === "middle" || value === "bottom" || value === "top") return value;
  return "top";
};

const DEFAULT_PAGE_WIDTH = 560;
const DEFAULT_PAGE_HEIGHT = 760;
const ALIGNMENT_HORIZONTAL_TOLERANCE = 28;
const ALIGNMENT_VERTICAL_TOLERANCE = 120;
const ALIGNMENT_MIN_BASELINE_Y = 6;
const ALIGNMENT_MIN_DELTA = 0.25;

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  startA < endB && endA > startB;

const distanceBetweenRanges = (startA: number, endA: number, startB: number, endB: number) => {
  if (rangesOverlap(startA, endA, startB, endB)) return 0;
  return startA < startB ? startB - endA : startA - endB;
};

const centerInsideRect = (
  centerX: number,
  centerY: number,
  rect: { x: number; y: number; w: number; h: number },
  padding = 0
) =>
  centerX >= rect.x - padding &&
  centerX <= rect.x + rect.w + padding &&
  centerY >= rect.y - padding &&
  centerY <= rect.y + rect.h + padding;

const resolveBaselineAlignmentCandidate = (
  block: IFormBlock,
  suggestions: MissingFieldSuggestion[]
) => {
  const schema = block.field_schema;
  if (!schema || block.block_type !== "form_field") return null;

  const fieldCenterX = schema.x + schema.w / 2;
  const fieldCenterY = schema.y + schema.h / 2;
  const fieldBaselineOffset = computePreviewBaselineOffset({
    fieldType: schema.type,
    fieldFont: schema.font,
    fontSize: schema.size,
    fieldHeight: schema.h,
    alignV: normalizeVerticalAlign(schema.align_v),
  });
  const currentBaselineY = schema.y + fieldBaselineOffset;

  let best: {
    baselineY: number;
    overlapsRegion: boolean;
    suggestionId: string;
    score: number;
  } | null = null;

  for (const suggestion of suggestions) {
    if (suggestion.page !== schema.page) continue;

    const suggestionBaselineY = getDetectedRegionBaselineY(suggestion);
    if (suggestionBaselineY < ALIGNMENT_MIN_BASELINE_Y) continue;

    const suggestionCenterX = suggestion.x + suggestion.w / 2;
    const suggestionCenterY = suggestion.y + suggestion.h / 2;
    const horizontalGap = distanceBetweenRanges(
      schema.x,
      schema.x + schema.w,
      suggestion.x,
      suggestion.x + suggestion.w
    );
    const overlapsX = rangesOverlap(
      schema.x,
      schema.x + schema.w,
      suggestion.x,
      suggestion.x + suggestion.w
    );
    const overlapsY = rangesOverlap(
      schema.y,
      schema.y + schema.h,
      suggestion.y,
      suggestion.y + suggestion.h
    );
    const overlapsRegion = overlapsX && overlapsY;
    const fieldCenterInSuggestion = centerInsideRect(fieldCenterX, fieldCenterY, suggestion, 8);
    const suggestionCenterInField = centerInsideRect(
      suggestionCenterX,
      suggestionCenterY,
      schema,
      8
    );
    const horizontallyClose =
      overlapsX ||
      horizontalGap <= ALIGNMENT_HORIZONTAL_TOLERANCE ||
      Math.abs(fieldCenterX - suggestionCenterX) <=
        Math.max(ALIGNMENT_HORIZONTAL_TOLERANCE, (schema.w + suggestion.w) / 2);
    const fieldVerticallyTouchesBaseline =
      suggestionBaselineY >= schema.y - ALIGNMENT_VERTICAL_TOLERANCE &&
      suggestionBaselineY <= schema.y + schema.h + ALIGNMENT_VERTICAL_TOLERANCE;
    const verticallyClose =
      Math.abs(currentBaselineY - suggestionBaselineY) <= ALIGNMENT_VERTICAL_TOLERANCE ||
      Math.abs(fieldCenterY - suggestionCenterY) <= ALIGNMENT_VERTICAL_TOLERANCE ||
      fieldVerticallyTouchesBaseline;
    const sameRowCandidate =
      Math.abs(currentBaselineY - suggestionBaselineY) <= ALIGNMENT_VERTICAL_TOLERANCE &&
      horizontalGap <= Math.max(ALIGNMENT_HORIZONTAL_TOLERANCE, schema.w, suggestion.w);
    const eligibleCandidate =
      overlapsRegion ||
      fieldCenterInSuggestion ||
      suggestionCenterInField ||
      (horizontallyClose && verticallyClose) ||
      sameRowCandidate;

    if (!eligibleCandidate) continue;

    const baselineDistance = Math.abs(currentBaselineY - suggestionBaselineY);
    const centerDistance = Math.hypot(
      fieldCenterX - suggestionCenterX,
      fieldCenterY - suggestionCenterY
    );
    const score =
      baselineDistance * 4 +
      horizontalGap * 1.5 +
      centerDistance * 0.25 -
      (overlapsRegion ? 40 : 0) -
      (overlapsX ? 20 : 0) -
      (fieldCenterInSuggestion || suggestionCenterInField ? 12 : 0) -
      (horizontallyClose && verticallyClose ? 8 : 0) -
      (sameRowCandidate ? 8 : 0);

    if (!best || score < best.score) {
      best = {
        baselineY: suggestionBaselineY,
        overlapsRegion,
        suggestionId: suggestion.id,
        score,
      };
    }
  }

  if (!best) return null;

  return {
    overlapsRegion: best.overlapsRegion,
    score: best.score,
    suggestionId: best.suggestionId,
    y: Math.max(0, best.baselineY - fieldBaselineOffset),
  };
};

/**
 * PdfViewer - Context-driven PDF editor component
 * Uses PdfViewerContext for PDF state and FormEditorContext for form data
 * Pure presentation component - all logic is in contexts
 */
export function PdfViewer() {
  const {
    blocks,
    selectedFieldId,
    selectedPartyId,
    setSelectedPartyId,
    handleFieldSelectFromPdf,
    handleBlockCreate,
    handleBlocksCreate,
    handleBlockUpdate,
    setPreferredPlacementPage,
    editorViewMode,
    setEditorViewMode,
    setSelectedBlockId,
    setSelectedBlockGroup,
    pendingMissingFieldDraft,
    setPendingMissingFieldDraft,
  } = useFormEditorTab();

  const { formMetadata, updateBlocks } = useFormEditor();
  const { registry: fieldRegistryDetails } = useFieldTemplateContext();

  const {
    pdfDoc,
    pageCount,
    visiblePage,
    setVisiblePage,
    scale,
    setScale,
    isLoadingDoc,
    error,
    isDragging,
    setIsDragging,
    handleFileUpload,
    registry,
  } = usePdfViewer();

  // Setup PDF worker
  useEffect(() => {
    if (typeof window === "undefined") return;
    const workerFile = pdfjsVersion.startsWith("4") ? "pdf.worker.min.mjs" : "pdf.worker.min.js";
    GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/${workerFile}`;
    ensurePreviewFontsLoaded();
  }, []);

  // File upload handler
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleZoom = (direction: "in" | "out") => {
    const delta = direction === "in" ? 0.1 : -0.1;
    const newScale = clamp(parseFloat((scale + delta).toFixed(2)), 0.5, 3);
    setScale(newScale);
  };

  const pagesArray = useMemo(
    () => Array.from({ length: pageCount }, (_, idx) => idx + 1),
    [pageCount]
  );

  useEffect(() => {
    setPreferredPlacementPage(visiblePage);
  }, [visiblePage, setPreferredPlacementPage]);

  useEffect(() => {
    if (!formMetadata || pageCount <= 0) return;

    const currentBlocks = formMetadata.schema.blocks || [];
    const keptBlocks = currentBlocks.filter((block) => {
      if (block.block_type !== "form_field") return true;
      const page = block.field_schema?.page;
      if (typeof page !== "number") return true;
      return page <= pageCount;
    });

    const removedCount = currentBlocks.length - keptBlocks.length;
    if (removedCount <= 0) return;

    const reorderedBlocks = keptBlocks.map((block, index) => ({
      ...block,
      order: index,
    }));
    updateBlocks(reorderedBlocks);

    toast.info(
      `Removed ${removedCount} field${removedCount === 1 ? "" : "s"} from pages beyond ${pageCount}.`,
      toastPresets.alert
    );
  }, [formMetadata, pageCount, updateBlocks]);
  const pageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const [showBaselineGuides, setShowBaselineGuides] = useState(false);
  const [showMissingFieldSuggestions, setShowMissingFieldSuggestions] = useState(false);
  const [isMissingFieldScanRunning, setIsMissingFieldScanRunning] = useState(false);
  const [isBaselineAlignmentRunning, setIsBaselineAlignmentRunning] = useState(false);
  const [missingFieldSuggestions, setMissingFieldSuggestions] = useState<MissingFieldSuggestion[]>(
    []
  );
  const [selectedMissingSuggestionId, setSelectedMissingSuggestionId] = useState<string | null>(
    null
  );
  const resolvedSystemPresets = useMemo(() => resolveSystemPresetTemplates(registry), [registry]);
  const registerPageRef = useCallback((page: number, node: HTMLDivElement | null) => {
    pageRefs.current.set(page, node);
  }, []);
  const visibleMissingSuggestions = useMemo(() => {
    const mappedFieldRects = toExistingFieldRects(blocks);
    const reclassified = classifyBlankRegionsAgainstBlocks(
      missingFieldSuggestions,
      mappedFieldRects
    );
    return reclassified.filter((suggestion) => suggestion.classification === "missing");
  }, [blocks, missingFieldSuggestions]);

  useEffect(() => {
    if (pendingMissingFieldDraft) return;
    if (!selectedMissingSuggestionId) return;
    const stillVisible = visibleMissingSuggestions.some(
      (suggestion) => suggestion.id === selectedMissingSuggestionId
    );
    if (!stillVisible) {
      setSelectedMissingSuggestionId(null);
    }
  }, [pendingMissingFieldDraft, selectedMissingSuggestionId, visibleMissingSuggestions]);

  const runMissingFieldScan = useCallback(async () => {
    if (!pdfDoc) return;

    setIsMissingFieldScanRunning(true);
    try {
      const suggestions = await runMissingFieldPipeline({ pdfDoc, blocks });
      setMissingFieldSuggestions(suggestions);
      setSelectedMissingSuggestionId(
        suggestions.find((suggestion) => suggestion.classification === "missing")?.id || null
      );
      setShowMissingFieldSuggestions(true);
      setPendingMissingFieldDraft(null);
    } catch (error) {
      console.error("Failed to scan for missing fields", error);
      toast.error("Failed to scan PDF for missing fields.", toastPresets.destructive);
    } finally {
      setIsMissingFieldScanRunning(false);
    }
  }, [blocks, pdfDoc, setPendingMissingFieldDraft]);

  const alignNearbyFieldsToBaselines = useCallback(async () => {
    if (!pdfDoc) return;

    setIsBaselineAlignmentRunning(true);
    try {
      const suggestions = await runMissingFieldPipeline({ pdfDoc, blocks });
      if (suggestions.length <= 0) {
        toast.info("No baselines found in this PDF.", toastPresets.alert);
        return;
      }

      const pageHeights = new Map<number, number>();

      for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
        const page = await pdfDoc.getPage(pageNumber);
        pageHeights.set(pageNumber, page.getViewport({ scale: 1 }).height);
      }

      let alignedCount = 0;
      const alignmentCandidates = new Map<
        string,
        ReturnType<typeof resolveBaselineAlignmentCandidate>
      >();

      for (const block of blocks) {
        const candidate = resolveBaselineAlignmentCandidate(block, suggestions);
        if (!candidate) continue;

        alignmentCandidates.set(block._id, candidate);
      }

      const nextBlocks = blocks.map((block) => {
        const schema = block.field_schema;
        if (!schema || block.block_type !== "form_field") return block;

        const candidate = alignmentCandidates.get(block._id);
        if (!candidate) return block;

        const pageHeight = pageHeights.get(schema.page) ?? DEFAULT_PAGE_HEIGHT;
        const nextY = clamp(candidate.y, 0, Math.max(0, pageHeight - schema.h));
        if (nextY <= 0 && schema.y > ALIGNMENT_VERTICAL_TOLERANCE / 2) return block;
        if (Math.abs(nextY - schema.y) < ALIGNMENT_MIN_DELTA) return block;

        alignedCount += 1;
        return {
          ...block,
          field_schema: {
            ...schema,
            y: nextY,
          },
        };
      });

      if (alignedCount <= 0) {
        toast.info("No nearby fields found to align.", toastPresets.alert);
        return;
      }

      updateBlocks(nextBlocks);
      toast.success(
        `Aligned ${alignedCount} field${alignedCount === 1 ? "" : "s"} to baselines.`,
        toastPresets.success
      );
    } catch (error) {
      console.error("Failed to align fields to baselines", error);
      toast.error("Failed to align fields to baselines.", toastPresets.destructive);
    } finally {
      setIsBaselineAlignmentRunning(false);
    }
  }, [blocks, pdfDoc, updateBlocks]);

  const selectSuggestionDraft = useCallback(
    (suggestionId: string) => {
      const target = visibleMissingSuggestions.find((suggestion) => suggestion.id === suggestionId);
      if (!target) return;

      const nextPartyId = selectedPartyId || formMetadata?.signing_parties?.[0]?._id || "";
      if (!nextPartyId) {
        toast.error(
          "Please add a recipient before accepting suggested fields.",
          toastPresets.alert
        );
        return;
      }

      setSelectedMissingSuggestionId(target.id);
      setVisiblePage(target.page);
      const pageNode = pageRefs.current.get(target.page);
      pageNode?.scrollIntoView({ behavior: "smooth", block: "center" });

      const draftBlock = createBlockFromSuggestionWithPreset({
        suggestion: target,
        signingPartyId: nextPartyId,
        presets: resolvedSystemPresets,
        registryFields: fieldRegistryDetails,
      });
      setPendingMissingFieldDraft(draftBlock);
      setSelectedBlockId(draftBlock._id);
      setSelectedBlockGroup(null);
    },
    [
      formMetadata?.signing_parties,
      resolvedSystemPresets,
      selectedPartyId,
      setPendingMissingFieldDraft,
      setSelectedBlockGroup,
      setSelectedBlockId,
      setVisiblePage,
      fieldRegistryDetails,
      visibleMissingSuggestions,
    ]
  );

  const clearMissingFieldSuggestions = useCallback(() => {
    setShowMissingFieldSuggestions(false);
    setMissingFieldSuggestions([]);
    setSelectedMissingSuggestionId(null);

    if (pendingMissingFieldDraft) {
      if (selectedFieldId === pendingMissingFieldDraft._id) {
        setSelectedBlockId(null);
      }
      setPendingMissingFieldDraft(null);
    }
  }, [pendingMissingFieldDraft, selectedFieldId, setPendingMissingFieldDraft, setSelectedBlockId]);

  useEffect(() => {
    if (!selectedFieldId) return;
    const container = pdfContainerRef.current;
    if (!container) return;

    const scrollToField = () => {
      const fieldNode = container.querySelector(
        `[data-field-id="${selectedFieldId}"]`
      ) as HTMLElement | null;
      fieldNode?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    };

    const frameId = window.requestAnimationFrame(scrollToField);
    return () => window.cancelAnimationFrame(frameId);
  }, [selectedFieldId]);

  const handlePdfScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const containerRect = e.currentTarget.getBoundingClientRect();
      const anchorY = containerRect.top + 24;
      let closestPage = visiblePage;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const page of pagesArray) {
        const node = pageRefs.current.get(page);
        if (!node) continue;
        const rect = node.getBoundingClientRect();
        const distance = Math.abs(rect.top - anchorY);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = page;
        }
      }

      if (closestPage !== visiblePage) {
        setVisiblePage(closestPage);
      }
    },
    [pagesArray, setVisiblePage, visiblePage]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    },
    [setIsDragging]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    },
    [setIsDragging]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const fieldData = e.dataTransfer.getData("field");
      if (fieldData) {
        try {
          const draggedField = JSON.parse(fieldData) as DraggedFieldPayload;

          console.log("Dragged field data:", draggedField);
          console.log("Prefiller value:", draggedField.prefiller);

          const rect = e.currentTarget.getBoundingClientRect();
          const displayX = e.clientX - rect.left;
          const displayY = e.clientY - rect.top;

          if (draggedField.composite_template === SIGNATURE_PRINTED_NAME_TEMPLATE.key) {
            const { signaturePreset, shortTextPreset } = getCompositePresets(registry);
            const dimensions = resolveSignaturePrintedNameDimensions({
              signaturePreset,
              shortTextPreset,
            });

            const rawX = (displayX - dimensions.signatureWidth / 2) / scale;
            const rawY = (displayY - dimensions.signatureHeight / 2) / scale;
            const x = clamp(rawX, 0, Math.max(0, DEFAULT_PAGE_WIDTH - dimensions.signatureWidth));
            const y = clamp(rawY, 0, Math.max(0, DEFAULT_PAGE_HEIGHT - dimensions.totalHeight));

            const pairBlocks = createSignaturePrintedNameBlocks({
              partyId: selectedPartyId || "",
              page: visiblePage,
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
              page: visiblePage,
              x: Math.max(0, (displayX - fieldWidth / 2) / scale),
              y: Math.max(0, (displayY - fieldHeight / 2) / scale),
              w: baseSchema?.w ?? fieldWidth,
              h: baseSchema?.h ?? fieldHeight,
              align_h: baseSchema?.align_h ?? defaults?.align_h ?? "center",
              align_v: baseSchema?.align_v ?? defaults?.align_v ?? "bottom",
              shared:
                typeof baseSchema?.shared === "boolean"
                  ? baseSchema.shared
                  : (draggedField.shared ?? true),
              source: (baseSchema?.source ||
                draggedField.source ||
                "manual") as IFormField["source"],
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

          console.log("Created block field_schema:", newBlock.field_schema);
          handleBlockCreate(newBlock);
        } catch (err) {
          console.error("Error parsing field data:", err);
        }
        return;
      }

      const files = e.dataTransfer.files;
      const file = Array.from(files).find((f) => f.type === "application/pdf") || files[0];
      if (file) handleFileUpload(file);
    },
    [
      scale,
      visiblePage,
      selectedPartyId,
      handleBlockCreate,
      handleBlocksCreate,
      setIsDragging,
      handleFileUpload,
      registry,
    ]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <RecipientTabBar
        parties={formMetadata?.signing_parties || []}
        selectedPartyId={selectedPartyId}
        onSelectParty={setSelectedPartyId}
      />
      {/* Header */}
      <div className="relative flex-shrink-0 border-b border-slate-300 bg-white px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={editorViewMode === "form" ? "default" : "outline"}
              onClick={() => setEditorViewMode(editorViewMode === "form" ? "pdf" : "form")}
              className="min-w-34 gap-2"
            >
              <span>Form View</span>
              <Switch
                checked={editorViewMode === "form"}
                aria-label="Form View visual indicator"
                disabled
                className="pointer-events-none border border-slate-400 data-[state=checked]:border-white"
              />
            </Button>

            {editorViewMode === "pdf" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    title="Open PDF tools"
                    aria-label="Open PDF tools"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuLabel>PDF Tools</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      if (showMissingFieldSuggestions) {
                        clearMissingFieldSuggestions();
                        return;
                      }
                      void runMissingFieldScan();
                    }}
                    disabled={!pdfDoc || isMissingFieldScanRunning}
                  >
                    {isMissingFieldScanRunning
                      ? "Scanning..."
                      : showMissingFieldSuggestions
                        ? "Clear Missing Fields"
                        : "Find Missing Fields"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void alignNearbyFieldsToBaselines()}
                    disabled={!pdfDoc || isMissingFieldScanRunning || isBaselineAlignmentRunning}
                  >
                    {isBaselineAlignmentRunning ? "Aligning..." : "Align Fields to Baselines"}
                  </DropdownMenuItem>
                  <DropdownMenuCheckboxItem
                    checked={showBaselineGuides}
                    onCheckedChange={(checked) => setShowBaselineGuides(Boolean(checked))}
                  >
                    Show baselines
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-700">
                {visiblePage}/{pageCount || 1}
              </span>
              <div className="ml-1 inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleZoom("out")}
                  disabled={scale <= 0.5}
                  className="rounded p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                  title="Zoom out"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleZoom("in")}
                  disabled={scale >= 3}
                  className="rounded p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                  title="Zoom in"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="w-10 text-center text-[11px] font-medium text-slate-700">
                {Math.round(scale * 100)}%
              </span>
            </div>

            {editorViewMode === "pdf" ? (
              <>
                <label
                  className="flex cursor-pointer items-center rounded p-1.5 text-sm transition-colors hover:bg-slate-100"
                  title="Upload PDF"
                  aria-label="Upload PDF"
                >
                  <FileUp className="h-4 w-4" />
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* PDF Canvas / Form View */}
      <div className="relative flex-1 overflow-hidden bg-white">
        {editorViewMode === "form" ? (
          <FormViewBlocksPanel signingParties={formMetadata?.signing_parties || []} />
        ) : (
          <div className="flex h-full min-w-0">
            <div ref={pdfContainerRef} className="relative min-w-0 flex-1 overflow-hidden">
              {isLoadingDoc && (
                <div className="bg-background/70 absolute inset-0 z-10 flex items-center justify-center">
                  <Loader>Loading PDFâ€¦</Loader>
                </div>
              )}

              {error && (
                <div className="text-destructive flex h-full items-center justify-center text-sm">
                  {error}
                </div>
              )}

              {!error && !pdfDoc && !isLoadingDoc && (
                <div className="flex h-full flex-col items-center justify-center gap-8">
                  <div className="text-center">
                    <p className="text-base font-medium text-slate-900">Drop your PDF here</p>
                    <p className="mt-1 text-sm text-slate-500">
                      or click the button below to browse
                    </p>
                  </div>

                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "flex h-80 w-120 cursor-pointer flex-col items-center justify-center rounded-[0.33em] border-2 border-dashed transition-colors",
                      isDragging
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-300 bg-slate-50 hover:border-slate-400"
                    )}
                  >
                    <FileUp className="h-16 w-16 text-slate-400" />
                  </div>

                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Button asChild>
                      <span>
                        <FileUp className="h-5 w-5" />
                        Upload PDF
                      </span>
                    </Button>
                  </label>
                </div>
              )}

              {pdfDoc && (
                <div
                  className="h-full overflow-auto p-4"
                  aria-live="polite"
                  onScroll={handlePdfScroll}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="flex w-full flex-col items-center gap-4">
                    {pagesArray.map((page) => (
                      <PdfPageCanvas
                        key={page}
                        pdf={pdfDoc}
                        pageNumber={page}
                        scale={scale}
                        isSelected={page === visiblePage}
                        _isVisible={page === visiblePage}
                        onVisible={setVisiblePage}
                        registerPageRef={registerPageRef}
                        blocks={blocks}
                        selectedFieldId={selectedFieldId}
                        onFieldSelect={handleFieldSelectFromPdf}
                        onBlockUpdate={handleBlockUpdate}
                        selectedPartyId={selectedPartyId}
                        _registry={registry}
                        formMetadata={formMetadata}
                        showBaselineGuides={showBaselineGuides}
                        showMissingFieldSuggestions={showMissingFieldSuggestions}
                        suggestions={visibleMissingSuggestions}
                        selectedSuggestionId={selectedMissingSuggestionId}
                        onSuggestionSelect={selectSuggestionDraft}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
