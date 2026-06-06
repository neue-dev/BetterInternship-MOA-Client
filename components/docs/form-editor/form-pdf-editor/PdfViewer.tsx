"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GlobalWorkerOptions, version as pdfjsVersion } from "pdfjs-dist";
import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import { useFormEditorPdfViewer } from "@/app/contexts/pdf-viewer.context";
import { resolveSystemPresetTemplates } from "@/lib/system-preset-resolver";
import { SIGNATURE_PRINTED_NAME_TEMPLATE } from "@/lib/composite-field-templates";
import { ensurePreviewFontsLoaded } from "@/lib/form-previewer-rendering";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { useFieldTemplateContext } from "@/app/contexts/field-template.ctx";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Undo2, Redo2, SlidersHorizontal } from "lucide-react";
import { PdfPageCanvas } from "./PdfPageCanvas";
import {
  buildCompositeDropBlocks,
  buildDroppedFieldBlock,
  type DraggedFieldPayload,
} from "./dropped-field-block-factory";
import { clamp, DEFAULT_PAGE_HEIGHT, DEFAULT_PAGE_WIDTH } from "./pdf-editor-utils";
import { useMissingFields } from "./use-missing-fields";
import { useBaselineAlignment } from "./use-baseline-alignment";
import { PdfViewerToolbar } from "./PdfViewerToolbar";
import { PdfViewerStatus } from "./PdfViewerStatus";
import { RecipientTabBar } from "@/components/docs/form-editor/RecipientTabBar";

/**
 * PdfViewer - Context-driven PDF editor component
 * Uses PdfViewerContext for PDF state and FormEditorContext for form data
 * Pure presentation component - all logic is in contexts
 */
type PdfViewerProps = {
  showRecipientTabBar?: boolean;
  // Optional: lets a parent observe this panel's scroll container (used to sync
  // scroll position with the preview when crossfading). Unused elsewhere.
  registerScrollContainer?: (el: HTMLElement | null) => void;
};

export function PdfViewer({ showRecipientTabBar = true, registerScrollContainer }: PdfViewerProps) {
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
    setSelectedBlockId,
    setSelectedBlockGroup,
    pendingMissingFieldDraft,
    setPendingMissingFieldDraft,
  } = useEditorSelection();

  const { formMetadata, updateBlocks, canUndo, canRedo, undo, redo } = useFormEditorMetadata();
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
  } = useFormEditorPdfViewer();

  const canUseTools = !!pdfDoc;

  // Setup PDF worker
  useEffect(() => {
    if (typeof window === "undefined") return;
    const workerFile = pdfjsVersion.startsWith("4") ? "pdf.worker.min.mjs" : "pdf.worker.min.js";
    GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/${workerFile}`;
    ensurePreviewFontsLoaded();
  }, []);

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
  const resolvedSystemPresets = useMemo(() => resolveSystemPresetTemplates(registry), [registry]);
  const registerPageRef = useCallback((page: number, node: HTMLDivElement | null) => {
    pageRefs.current.set(page, node);
  }, []);

  const {
    showMissingFieldSuggestions,
    isMissingFieldScanRunning,
    visibleMissingSuggestions,
    selectedMissingSuggestionId,
    runMissingFieldScan,
    selectSuggestionDraft,
    clearMissingFieldSuggestions,
  } = useMissingFields({
    pdfDoc,
    blocks,
    selectedFieldId,
    selectedPartyId,
    formMetadata,
    resolvedSystemPresets,
    fieldRegistryDetails,
    pageRefs,
    pendingMissingFieldDraft,
    setPendingMissingFieldDraft,
    setSelectedBlockId,
    setSelectedBlockGroup,
    setVisiblePage,
  });

  const { isBaselineAlignmentRunning, alignNearbyFieldsToBaselines } = useBaselineAlignment({
    pdfDoc,
    blocks,
    updateBlocks,
  });

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

          const rect = e.currentTarget.getBoundingClientRect();
          const displayX = e.clientX - rect.left;
          const displayY = e.clientY - rect.top;

          if (draggedField.composite_template === SIGNATURE_PRINTED_NAME_TEMPLATE.key) {
            const pairBlocks = buildCompositeDropBlocks({
              registry,
              page: visiblePage,
              selectedPartyId,
              resolvePosition: (dimensions) => {
                const rawX = (displayX - dimensions.signatureWidth / 2) / scale;
                const rawY = (displayY - dimensions.signatureHeight / 2) / scale;
                return {
                  x: clamp(rawX, 0, Math.max(0, DEFAULT_PAGE_WIDTH - dimensions.signatureWidth)),
                  y: clamp(rawY, 0, Math.max(0, DEFAULT_PAGE_HEIGHT - dimensions.totalHeight)),
                };
              },
            });
            handleBlocksCreate(pairBlocks);
            return;
          }

          const newBlock = buildDroppedFieldBlock({
            draggedField,
            page: visiblePage,
            blocks,
            selectedPartyId,
            resolvePosition: ({ fieldWidth, fieldHeight }) => ({
              x: Math.max(0, (displayX - fieldWidth / 2) / scale),
              y: Math.max(0, (displayY - fieldHeight / 2) / scale),
            }),
          });
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

  const handleToggleMissingFields = () => {
    if (showMissingFieldSuggestions) {
      clearMissingFieldSuggestions();
      return;
    }
    void runMissingFieldScan();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      {showRecipientTabBar && (
        <RecipientTabBar
          parties={formMetadata?.signing_parties || []}
          selectedPartyId={selectedPartyId}
          onSelectParty={setSelectedPartyId}
        />
      )}

      <PdfViewerToolbar
        visiblePage={visiblePage}
        pageCount={pageCount}
        scale={scale}
        onZoom={handleZoom}
        onFileChange={handleFileChange}
      >
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
              onClick={handleToggleMissingFields}
              disabled={!canUseTools || isMissingFieldScanRunning}
            >
              {isMissingFieldScanRunning
                ? "Scanning..."
                : showMissingFieldSuggestions
                  ? "Clear Missing Fields"
                  : "Find Missing Fields"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void alignNearbyFieldsToBaselines()}
              disabled={!canUseTools || isMissingFieldScanRunning || isBaselineAlignmentRunning}
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
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          className="rounded p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          className="rounded p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </PdfViewerToolbar>

      {/* PDF Canvas */}
      <div className="relative flex-1 overflow-hidden bg-white">
        <div className="flex h-full min-w-0">
          <div ref={pdfContainerRef} className="relative min-w-0 flex-1 overflow-hidden">
            <PdfViewerStatus
              pdfDoc={pdfDoc}
              isLoadingDoc={isLoadingDoc}
              error={error}
              isDragging={isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onFileChange={handleFileChange}
            />

            {pdfDoc && (
              <div
                ref={registerScrollContainer}
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
      </div>
    </div>
  );
}
