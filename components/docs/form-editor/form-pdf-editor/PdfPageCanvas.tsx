"use client";

import { memo, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { cn } from "@/lib/utils";
import { RadioGroupOverlay } from "./RadioGroupOverlay";
import { FieldRegistryEntry } from "@/app/api";
import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import { IFormBlock, IFormMetadata } from "@betterinternship/core/forms";
import { SIGNATURE_PRINTED_NAME_TEMPLATE } from "@/lib/composite-field-templates";
import type { MissingFieldSuggestion } from "@/lib/missing-fields/pipeline";
import { usePdfCoordinateTransform, type PointerLocation } from "./use-pdf-coordinate-transform";
import { clamp } from "./pdf-editor-utils";
import {
  buildCompositeDropBlocks,
  buildDroppedFieldBlock,
  type DraggedFieldPayload,
} from "./dropped-field-block-factory";
import { usePdfPageRenderer } from "@betterinternship/core/pdf-viewer";
import { usePageObservers } from "./use-page-observers";
import { useFieldInteractions } from "./use-field-interactions";
import { useRadioGroup } from "./use-radio-group";
import { PdfPageHeader } from "./PdfPageHeader";
import { PdfFieldLayer } from "./PdfFieldLayer";
import { MissingFieldSuggestionsOverlay } from "./MissingFieldSuggestionsOverlay";

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
    } = useEditorSelection();
    const { updateBlocks } = useFormEditorMetadata();

    const [localHover, setLocalHover] = useState<PointerLocation | null>(null);

    const { containerRef, containerResizeVersion } = usePageObservers(
      pageNumber,
      onVisible,
      registerPageRef
    );
    const { canvasRef, viewportRef, pageReady } = usePdfPageRenderer(pdf, pageNumber, scale);
    const { extractLocation, pdfToDisplay, displayDeltaToPdfDelta } = usePdfCoordinateTransform(
      canvasRef,
      viewportRef,
      scale,
      pageNumber
    );

    const {
      handleFieldDrag,
      handleFieldResize,
      handleFieldRecipientChange,
      findSameFieldIds,
      handleSelectNextSameField,
      handleSelectPrevSameField,
    } = useFieldInteractions({
      blocks,
      onBlockUpdate,
      updateBlocks,
      displayDeltaToPdfDelta,
      onVisible,
      onFieldSelect,
    });

    const {
      activeGroupDrag,
      selectFirstFieldInGroup,
      handleAddRadioOption,
      handleGroupDragMove,
      handleGroupDragEnd,
      handleDuplicateField,
    } = useRadioGroup({
      blocks,
      updateBlocks,
      displayDeltaToPdfDelta,
      onFieldSelect,
      handleBlockCreate,
      handleBlocksCreate,
      handleDuplicateBlock,
    });

    const clearSelection = () => {
      setSelectedFieldId(null);
      setSelectedBlockId(null);
    };

    const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
      if (event.buttons > 0) return; // skip during drag/resize to prevent re-render feedback loop
      setLocalHover(extractLocation(event));
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

        const location = extractLocation(e);
        if (!location) return;

        if (draggedField.composite_template === SIGNATURE_PRINTED_NAME_TEMPLATE.key) {
          const pairBlocks = buildCompositeDropBlocks({
            registry: _registry,
            page: pageNumber,
            selectedPartyId,
            resolvePosition: (dimensions) => {
              const pageWidth = location.viewportWidth / scale;
              const pageHeight = location.viewportHeight / scale;
              const rawX = location.pdfX - dimensions.signatureWidth / 2;
              const rawY = location.pdfY - dimensions.signatureHeight / 2;
              return {
                x: clamp(rawX, 0, Math.max(0, pageWidth - dimensions.signatureWidth)),
                y: clamp(rawY, 0, Math.max(0, pageHeight - dimensions.totalHeight)),
              };
            },
          });
          handleBlocksCreate(pairBlocks);
          return;
        }

        const newBlock = buildDroppedFieldBlock({
          draggedField,
          page: pageNumber,
          blocks,
          selectedPartyId,
          resolvePosition: ({ fieldWidth, fieldHeight }) => ({
            x: location.pdfX - fieldWidth / 2,
            y: location.pdfY - fieldHeight / 2,
          }),
        });
        handleBlockCreate(newBlock);
      } catch (err) {
        console.error("Error dropping field:", err);
      }
    };

    return (
      <div
        ref={containerRef}
        data-page={pageNumber}
        className={cn(
          "relative w-fit max-w-none overflow-visible rounded-[0.33em] border bg-white shadow-sm transition-colors",
          isSelected ? "border-primary/80 ring-primary/50 ring-1" : "border-border"
        )}
        style={{ visibility: pageReady ? "visible" : "hidden" }}
      >
        <PdfPageHeader pageNumber={pageNumber} hover={localHover} />
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
            onGroupClick={selectFirstFieldInGroup}
            activeDrag={activeGroupDrag}
          />

          <PdfFieldLayer
            blocks={blocks}
            pageNumber={pageNumber}
            scale={scale}
            pdfToDisplay={pdfToDisplay}
            selectedFieldId={selectedFieldId}
            formMetadata={formMetadata}
            showBaselineGuides={showBaselineGuides}
            containerResizeVersion={containerResizeVersion}
            activeGroupDrag={activeGroupDrag}
            findSameFieldIds={findSameFieldIds}
            onFieldSelect={onFieldSelect}
            onFieldDrag={handleFieldDrag}
            onFieldResize={handleFieldResize}
            onFieldRecipientChange={handleFieldRecipientChange}
            onDeleteBlock={handleDeleteBlock}
            onDuplicateField={handleDuplicateField}
            onSelectPrevSameField={handleSelectPrevSameField}
            onSelectNextSameField={handleSelectNextSameField}
            onClearSelection={clearSelection}
          />

          <MissingFieldSuggestionsOverlay
            show={showMissingFieldSuggestions}
            suggestions={suggestions}
            pageNumber={pageNumber}
            scale={scale}
            pdfToDisplay={pdfToDisplay}
            selectedSuggestionId={selectedSuggestionId}
            onSuggestionSelect={onSuggestionSelect}
          />
        </div>
      </div>
    );
  }
);
PdfPageCanvas.displayName = "PdfPageCanvas";
