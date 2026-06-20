/**
 * FormEditorPdfViewer
 *
 * Top-level PDF viewer for the form template editor.
 * Extends BasePdfViewer with:
 *   - File-based PDF loading (upload or blob → File)
 *   - Drag-and-drop field placement onto pages
 *   - PDF file replacement via toolbar upload button
 *   - Recipient/party tab bar
 *   - Missing-field detection and auto-scroll (useMissingFields)
 *   - Undo/redo for field edits (toolbar children)
 *   - Drop-block composite fields (signature + printed name)
 *
 * Data flow:
 *   BasePdfViewer ← (scale, visiblePage, pageRefs, onScaleChange, ...)
 *   PdfPageCanvas ← renderPage() callback
 *   PdfViewerStatus ← loading/error/empty states
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import { useFormEditorPdfViewer } from "@/app/contexts/pdf-viewer.context";
import { resolveSystemPresetTemplates } from "@/lib/system-preset-resolver";
import { SIGNATURE_PRINTED_NAME_TEMPLATE } from "@/lib/composite-field-templates";
import { ensurePreviewFontsLoaded } from "@betterinternship/core/pdf-viewer";
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
import { DEFAULT_PAGE_HEIGHT, DEFAULT_PAGE_WIDTH } from "./pdf-editor-utils";
import { useMissingFields } from "./use-missing-fields";
import { useBaselineAlignment } from "./use-baseline-alignment";
import { PdfViewerStatus } from "./PdfViewerStatus";
import { RecipientTabBar } from "@/components/docs/form-editor/RecipientTabBar";
import { BasePdfViewer } from "@betterinternship/core/pdf-viewer";

type FormEditorPdfViewerProps = {
  showRecipientTabBar?: boolean;
  registerScrollContainer?: (el: HTMLElement | null) => void;
};

export function FormEditorPdfViewer({
  showRecipientTabBar = true,
  registerScrollContainer: externalRegisterScrollContainer,
}: FormEditorPdfViewerProps) {
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

  useEffect(() => {
    ensurePreviewFontsLoaded();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileUpload(file);
  };

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

  const resolvedSystemPresets = useMemo(() => resolveSystemPresetTemplates(registry), [registry]);

  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const handleRegisterScrollContainer = useCallback(
    (el: HTMLElement | null) => {
      scrollContainerRef.current = el;
      externalRegisterScrollContainer?.(el);
    },
    [externalRegisterScrollContainer]
  );

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

  const [showBaselineGuides, setShowBaselineGuides] = useState(false);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(true);

  const scrollToSelectedField = useCallback(() => {
    if (!selectedFieldId) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const fieldNode = container.querySelector(
      `[data-field-id="${selectedFieldId}"]`
    ) as HTMLElement | null;
    fieldNode?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }, [selectedFieldId]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(scrollToSelectedField);
    return () => window.cancelAnimationFrame(frameId);
  }, [scrollToSelectedField]);

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
                  x: Math.max(0, rawX),
                  y: Math.max(0, rawY),
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

  const renderPage = useCallback(
    (page: number) => (
      <PdfPageCanvas
        pdf={pdfDoc!}
        pageNumber={page}
        scale={scale}
        isSelected={page === visiblePage}
        _isVisible={page === visiblePage}
        onVisible={setVisiblePage}
        registerPageRef={() => {}}
        blocks={blocks}
        selectedFieldId={selectedFieldId}
        onFieldSelect={handleFieldSelectFromPdf}
        onBlockUpdate={handleBlockUpdate}
        selectedPartyId={selectedPartyId}
        _registry={registry}
        formMetadata={formMetadata}
        showBaselineGuides={showBaselineGuides}
        snapToGridEnabled={snapToGridEnabled}
        showMissingFieldSuggestions={showMissingFieldSuggestions}
        suggestions={visibleMissingSuggestions}
        selectedSuggestionId={selectedMissingSuggestionId}
        onSuggestionSelect={selectSuggestionDraft}
      />
    ),
    [
      blocks,
      formMetadata,
      handleFieldSelectFromPdf,
      handleBlockUpdate,
      registry,
      scale,
      selectSuggestionDraft,
      selectedFieldId,
      selectedMissingSuggestionId,
      selectedPartyId,
      setVisiblePage,
      showBaselineGuides,
      snapToGridEnabled,
      showMissingFieldSuggestions,
      visibleMissingSuggestions,
      visiblePage,
    ]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      {showRecipientTabBar && (
        <RecipientTabBar
          parties={formMetadata?.signing_parties || []}
          selectedPartyId={selectedPartyId}
          onSelectParty={setSelectedPartyId}
        />
      )}

      {!pdfDoc || isLoadingDoc || error ? (
        <div className="relative flex-1 overflow-hidden bg-white">
          <div className="flex h-full min-w-0">
            <div className="relative min-w-0 flex-1 overflow-hidden">
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
            </div>
          </div>
        </div>
      ) : (
        <BasePdfViewer
          pdfDoc={pdfDoc}
          pageCount={pageCount}
          scale={scale}
          onScaleChange={setScale}
          visiblePage={visiblePage}
          onVisiblePageChange={setVisiblePage}
          registerScrollContainer={handleRegisterScrollContainer}
          pageRefs={pageRefs}
          onFileChange={handleFileChange}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          renderPage={renderPage}
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
              <DropdownMenuCheckboxItem
                checked={snapToGridEnabled}
                onCheckedChange={(checked) => setSnapToGridEnabled(Boolean(checked))}
              >
                Snap to grid
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
        </BasePdfViewer>
      )}
    </div>
  );
}
