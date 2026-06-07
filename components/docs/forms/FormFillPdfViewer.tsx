/**
 * FormFillPdfViewer
 *
 * Top-level PDF viewer for signatory fill-out.
 * Extends BasePdfViewer with:
 *   - URL-based PDF loading (documentUrl prop)
 *   - Field value boxes overlaid on each page (PdfPageOverlay)
 *   - Ownership coloring and tooltips (mine/theirs)
 *   - Field click handling for selection
 *   - Auto-scroll to first empty required field on mount
 *   - Scroll-to-field on selection from sidebar
 *   - Bump animation on selected field
 *   - Prefill mode for live/dummy/none value display
 *
 * Data flow:
 *   BasePdfViewer ← (scale, visiblePage, pageRefs, onScaleChange, ...)
 *   PdfPageOverlay ← renderPage() callback
 *     └─ usePdfPageRenderer(pdf, pageNumber, scale) → canvas
 *     └─ Field overlay divs positioned via pdfToDisplay()
 *     └─ fitWrappedText / fitNoWrapText for font sizing
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { type IFormSigningParty } from "@betterinternship/core/forms";
import { Loader } from "@/components/ui/loader";
import {
  createPreviewDisplayValueResolver,
  groupFieldsByPage,
  isFieldRequired,
  normalizePreviewFieldKey,
  normalizePreviewFields,
  resolveOwnerMeta,
  type OwnerMeta,
  type PreviewField,
  type PreviewFieldLike,
} from "@/lib/form-previewer-model";
import {
  ensurePreviewFontsLoaded,
  fitNoWrapText,
  fitWrappedText,
  resolvePreviewFont,
} from "@/lib/form-previewer-rendering";
import { getSignatureImageFieldKey, parseSignatureImageValue } from "@betterinternship/core/forms";
import { usePdfDocumentFromUrl } from "@/hooks/use-pdf-document";
import { usePdfPageRenderer } from "@/hooks/use-pdf-page-renderer";
import { BasePdfViewer } from "@/components/docs/BasePdfViewer";

type DefaultFieldVisibility = "all" | "mine";
type FieldStatus = "empty" | "filled" | "signed";
type PreviewPrefillMode = "live" | "dummy" | "none";

const getFieldStatus = (fieldType: PreviewField["type"], value: string): FieldStatus => {
  if (!value.trim()) return "empty";
  if (fieldType === "signature") return "signed";
  return "filled";
};

const getPreviewRawValue = (values: Record<string, string>, fieldKey: string): unknown => {
  const normalizedFieldName = normalizePreviewFieldKey(fieldKey);
  return (
    values[fieldKey] ?? values[`${normalizedFieldName}:default`] ?? values[normalizedFieldName]
  );
};

const getSignatureImageSrc = (
  signatureImage: ReturnType<typeof parseSignatureImageValue>
): string => {
  if (!signatureImage) return "";
  if (signatureImage.image.storage === "bucket") {
    return signatureImage.image.signedUrl || signatureImage.image.publicUrl || "";
  }
  return signatureImage.image.dataUrl;
};

interface FormFillPdfViewerProps {
  documentUrl: string;
  values: Record<string, string>;
  fields?: PreviewFieldLike[];
  blocks?: PreviewFieldLike[]; // Backward-compatible alias
  headerLeft?: ReactNode;
  scale?: number;
  showToolbar?: boolean;
  onFieldClick?: (fieldName: string) => void;
  selectedFieldId?: string;
  selectionTick?: number;
  autoScrollToSelectedField?: boolean;
  signingParties?: IFormSigningParty[];
  currentSigningPartyId?: string;
  showOwnership?: boolean;
  fieldVisibility?: DefaultFieldVisibility;
  defaultFieldVisibility?: DefaultFieldVisibility;
  fieldErrors?: Record<string, string>;
  prefillMode?: PreviewPrefillMode;
  prefillUser?: Record<string, unknown> | null;
  squareFrame?: boolean;
  // Optional: lets a parent observe the scroll container (used by the form
  // editor to sync scroll position with the editor PDF when crossfading).
  registerScrollContainer?: (el: HTMLElement | null) => void;
  // Optional: reports the current zoom whenever it changes (used by the form
  // editor to sync zoom with the editor PDF when crossfading).
  onScaleChange?: (scale: number) => void;
}

const SIGNATURE_IMAGE_OVERFLOW_SCALE = 1.8;

/**
 * PDF display component that shows form fields as boxes overlaid on the PDF
 * Similar to PdfViewer but in read-only preview mode
 * Shows field boxes with current filled values
 */
export const FormFillPdfViewer = ({
  documentUrl,
  values,
  fields,
  blocks,
  headerLeft,
  scale: initialScale = 1.0,
  showToolbar = true,
  onFieldClick,
  selectedFieldId,
  selectionTick = 0,
  autoScrollToSelectedField = true,
  signingParties = [],
  currentSigningPartyId,
  showOwnership = false,
  fieldVisibility,
  defaultFieldVisibility = "mine",
  fieldErrors = {},
  prefillMode = "live",
  prefillUser = null,
  squareFrame = false,
  registerScrollContainer,
  onScaleChange,
  }: FormFillPdfViewerProps) => {
  const { pdfDoc, pageCount, isLoading: isLoadingDoc, error } =
    usePdfDocumentFromUrl(documentUrl);
  const [scale, setScale] = useState<number>(initialScale);
  const [visiblePage, setVisiblePage] = useState<number>(1);
  const [animatingFieldId, setAnimatingFieldId] = useState<string | null>(null);

  const pageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const didAutoFocusOwnedTaskRef = useRef(false);
  const normalizedFields = useMemo(
    () => normalizePreviewFields(fields?.length ? fields : (blocks ?? [])),
    [fields, blocks]
  );
  const resolveDisplayValue = useMemo(
    () =>
      createPreviewDisplayValueResolver({
        user: prefillUser,
        prefillMode,
      }),
    [prefillMode, prefillUser]
  );
  const effectiveFieldVisibility = fieldVisibility ?? defaultFieldVisibility;
  const ownerMetaByFieldId = useMemo(() => {
    const ownerMetaMap = new Map<string, OwnerMeta>();
    normalizedFields.forEach((field) => {
      ownerMetaMap.set(field.id, resolveOwnerMeta(field, signingParties, currentSigningPartyId));
    });
    return ownerMetaMap;
  }, [normalizedFields, signingParties, currentSigningPartyId]);
  const ownedFields = useMemo(
    () => normalizedFields.filter((field) => ownerMetaByFieldId.get(field.id)?.isMine),
    [normalizedFields, ownerMetaByFieldId]
  );
  const visibleFields = useMemo(() => {
    if (effectiveFieldVisibility !== "mine") return normalizedFields;
    if (!currentSigningPartyId) return normalizedFields;
    return normalizedFields.filter((field) => ownerMetaByFieldId.get(field.id)?.isMine);
  }, [normalizedFields, effectiveFieldVisibility, currentSigningPartyId, ownerMetaByFieldId]);
  const fieldsByPage = useMemo(() => groupFieldsByPage(visibleFields), [visibleFields]);

  // Keep internal zoom in sync with prop updates (e.g. mobile breakpoint after hydration).
  useEffect(() => {
    setScale(initialScale);
  }, [initialScale]);

  // Report current zoom so a parent can sync it (e.g. editor <-> preview crossfade).
  useEffect(() => {
    onScaleChange?.(scale);
  }, [scale, onScaleChange]);

  useEffect(() => {
    didAutoFocusOwnedTaskRef.current = false;
  }, [documentUrl]);

  useEffect(() => {
    if (!showOwnership) return;
    if (ownedFields.length === 0) return;

    if (didAutoFocusOwnedTaskRef.current) return;
    const firstEmptyRequiredOwnedField = ownedFields.find((field) => {
      if (!isFieldRequired(field)) return false;
      const rawValue = getPreviewRawValue(values, field.field);
      const value = resolveDisplayValue(field, rawValue);
      return getFieldStatus(field.type, value) === "empty";
    });

    if (firstEmptyRequiredOwnedField) {
      const pageNode = pageRefs.current.get(firstEmptyRequiredOwnedField.page);
      pageNode?.scrollIntoView({ behavior: "smooth", block: "center" });
      setAnimatingFieldId(firstEmptyRequiredOwnedField.field);
      setTimeout(() => setAnimatingFieldId(null), 700);
    }

    didAutoFocusOwnedTaskRef.current = true;
  }, [showOwnership, ownedFields, resolveDisplayValue, values]);

  // Jump to field's page and trigger animation when selected from form
  useEffect(() => {
    if (!selectedFieldId) return;

    if (autoScrollToSelectedField) {
      const selectedField = normalizedFields.find((field) => field.field === selectedFieldId);
      if (selectedField && selectedField.page) {
        const fieldPage = selectedField.page;
        const pageNode = pageRefs.current.get(fieldPage);
        pageNode?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    // Trigger bump animation
    setAnimatingFieldId(selectedFieldId);
    const timeout = setTimeout(() => setAnimatingFieldId(null), 600);
    return () => clearTimeout(timeout);
  }, [selectedFieldId, selectionTick, normalizedFields, autoScrollToSelectedField]);

  useEffect(() => {
    ensurePreviewFontsLoaded();
  }, []);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100">
        <div className="text-center">
          <p className="text-sm text-red-500">Failed to load PDF</p>
          <p className="mt-1 text-xs text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoadingDoc || !pdfDoc) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100">
        <Loader />
      </div>
    );
  }

  return (
    <BasePdfViewer
      pdfDoc={pdfDoc}
      pageCount={pageCount}
      scale={scale}
      visiblePage={visiblePage}
      onVisiblePageChange={setVisiblePage}
      onScaleChange={(s) => { setScale(s); onScaleChange?.(s); }}
      showToolbar={showToolbar}
      squareFrame={squareFrame}
      registerScrollContainer={registerScrollContainer}
      pageRefs={pageRefs}
      renderPage={(pageNumber) => (
        <PdfPageOverlay
          key={pageNumber}
          pdf={pdfDoc}
          pageNumber={pageNumber}
          scale={scale}
          fields={fieldsByPage.get(pageNumber) || []}
          values={values}
          onFieldClick={onFieldClick}
          animatingFieldId={animatingFieldId}
          selectedFieldId={selectedFieldId}
          ownerMetaByFieldId={ownerMetaByFieldId}
          showOwnership={showOwnership}
          fieldVisibility={effectiveFieldVisibility}
          fieldErrors={fieldErrors}
          resolveDisplayValue={resolveDisplayValue}
        />
      )}
    >
      {headerLeft}
    </BasePdfViewer>
  );
};

interface PdfPageOverlayProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  fields: PreviewField[];
  values: Record<string, string>;
  onFieldClick?: (fieldName: string) => void;
  animatingFieldId?: string | null;
  selectedFieldId?: string;
  ownerMetaByFieldId: Map<string, OwnerMeta>;
  showOwnership: boolean;
  fieldVisibility: DefaultFieldVisibility;
  fieldErrors: Record<string, string>;
  resolveDisplayValue: (field: PreviewField, rawValue: unknown) => string;
}

const PdfPageOverlay = ({
  pdf,
  pageNumber,
  scale,
  fields,
  values,
  onFieldClick,
  animatingFieldId,
  selectedFieldId,
  ownerMetaByFieldId,
  showOwnership,
  fieldVisibility,
  fieldErrors,
  resolveDisplayValue,
}: PdfPageOverlayProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { canvasRef, pageReady } = usePdfPageRenderer(pdf, pageNumber, scale);
  const [forceRender, setForceRender] = useState<number>(0);
  const [activeTouchFieldId, setActiveTouchFieldId] = useState<string | null>(null);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [isTouchInteraction, setIsTouchInteraction] = useState(false);
  const [clickedHighlightFieldId, setClickedHighlightFieldId] = useState<string | null>(null);

  // Force re-render of field positions when scale changes
  useEffect(() => {
    setForceRender((prev) => prev + 1);
  }, [scale]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setIsTouchInteraction(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // Convert PDF coordinates to display coordinates, accounting for zoom-aware rendering
  const pdfToDisplay = (
    pdfX: number,
    pdfY: number
  ): { displayX: number; displayY: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Metadata coordinates already use top-left origin (y=0 at top)
    // Scale them directly to display coordinates
    const displayX = pdfX * scale;
    const displayY = pdfY * scale;

    return {
      displayX,
      displayY,
    };
  };

  return (
    <div
      ref={containerRef}
      className="relative mx-auto rounded bg-white shadow"
      style={{
        width: "fit-content",
        visibility: pageReady ? "visible" : "hidden",
      }}
    >

      {/* Canvas - PDF page */}
      <canvas ref={canvasRef} className="block" />

      {/* Field boxes overlay */}
      {pageReady && (
      <div
        className="absolute inset-0"
        key={forceRender}
        onClick={() => {
          if (isTouchInteraction) setActiveTouchFieldId(null);
        }}
      >
        {fields.map((field) => {
          const x = field.x;
          const y = field.y;
          const w = field.w;
          const h = field.h;
          const fieldName = field.field;

          if (w <= 0 || h <= 0) {
            return null;
          }

          const displayPos = pdfToDisplay(x, y);
          if (!displayPos) {
            return null;
          }

          const widthPixels = w * scale;
          const heightPixels = h * scale;

          const ownerMeta =
            ownerMetaByFieldId.get(field.id) ??
            ({
              ownerRoleId: "unknown",
              ownerGroupId: "other",
              ownerLabel: "Unassigned",
              ownerColorHex: "#94a3b8",
              isMine: false,
              isKnownOwner: false,
            } satisfies OwnerMeta);
          const canRevealValue = !showOwnership || ownerMeta?.isMine || fieldVisibility === "all";
          const rawValue = canRevealValue ? getPreviewRawValue(values, fieldName) : "";
          const signatureImage =
            field.type === "signature"
              ? parseSignatureImageValue(values[getSignatureImageFieldKey(fieldName)])
              : null;
          const signatureImageSrc = getSignatureImageSrc(signatureImage);
          const valueStr = canRevealValue ? resolveDisplayValue(field, rawValue) : "";
          const isFilled = !!signatureImage || valueStr.trim().length > 0;

          // Get alignment and wrapping from field schema
          const align_h = field.align_h ?? "left";
          const align_v = field.align_v ?? "top";
          const shouldWrap = field.wrap ?? true;

          // Calculate optimal font size using PDF engine algorithm
          const fieldType: PreviewField["type"] = field.type ?? "text";
          const resolvedFont = resolvePreviewFont(fieldType, field.font);

          let fontSizeDoc: number;
          let lineHeightDoc: number;
          let displayLines: string[] = [];
          const fitSafetyUnits = 2;
          const fitMaxWidthDoc = Math.max(0, w - fitSafetyUnits);
          const fitMaxHeightDoc = Math.max(0, h - fitSafetyUnits);

          if (isFilled) {
            if (shouldWrap) {
              // Fit in document-space units so visual result stays stable across zoom levels.
              const fitted = fitWrappedText({
                text: valueStr,
                fontFamily: resolvedFont.canvasFamily,
                maxWidth: fitMaxWidthDoc,
                maxHeight: fitMaxHeightDoc,
                startSize: field.size ?? 11,
                lineHeightMult: 1.0,
              });
              fontSizeDoc = fitted.fontSize;
              lineHeightDoc = fitted.lineHeight;
              displayLines = fitted.lines || [];
            } else {
              // No wrapping - fit in document-space units.
              const defaultSize = fieldType === "signature" ? 25 : 11;
              const fitted = fitNoWrapText({
                text: valueStr,
                fontFamily: resolvedFont.canvasFamily,
                maxWidth: fitMaxWidthDoc,
                maxHeight: fitMaxHeightDoc,
                startSize: field.size ?? defaultSize,
              });

              fontSizeDoc = fitted.fontSize;
              lineHeightDoc = fontSizeDoc * 1.0;
              displayLines = [fitted.line];
            }
          } else {
            fontSizeDoc = field.size ?? (fieldType === "signature" ? 25 : 11);
            lineHeightDoc = fontSizeDoc * 1.0;
          }

          const fontSize = fontSizeDoc * scale;
          const lineHeight = lineHeightDoc * scale;

          const isSelected =
            animatingFieldId === fieldName ||
            selectedFieldId === fieldName ||
            clickedHighlightFieldId === field.id;
          const isClickable = !showOwnership || ownerMeta.isMine;
          const hasFieldError = !!fieldErrors[fieldName];
          const isOwnedField = showOwnership && ownerMeta.isMine;
          const isOwnedFieldValid = isOwnedField && isFilled && !hasFieldError;
          const ownedBorderColor = isOwnedFieldValid ? "#16a34a" : "#dc2626";
          const borderColor = showOwnership
            ? ownerMeta.isMine
              ? ownedBorderColor
              : "#d1d5db"
            : "#d1d5db";
          const ownedFillColor = isOwnedField
            ? isOwnedFieldValid
              ? "rgba(34, 197, 94, 0.2)"
              : "rgba(239, 68, 68, 0.2)"
            : "transparent";
          const showNonOwnedTooltip =
            showOwnership &&
            !ownerMeta.isMine &&
            (hoveredFieldId === field.id ||
              (isTouchInteraction && activeTouchFieldId === field.id));

          return (
            <div
              key={field.id}
              onMouseEnter={() => {
                if (showOwnership && !ownerMeta.isMine) setHoveredFieldId(field.id);
              }}
              onMouseLeave={() => {
                if (hoveredFieldId === field.id) setHoveredFieldId(null);
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (showOwnership && isTouchInteraction) {
                  if (activeTouchFieldId !== field.id) {
                    setActiveTouchFieldId(field.id);
                    return;
                  }
                  setActiveTouchFieldId(null);
                }
                if (showOwnership) {
                  setClickedHighlightFieldId(field.id);
                  setTimeout(
                    () => setClickedHighlightFieldId((prev) => (prev === field.id ? null : prev)),
                    550
                  );
                }
                if (!isClickable) return;
                onFieldClick?.(fieldName);
              }}
              className={`absolute text-black transition-all ${
                isClickable ? "cursor-pointer" : "cursor-default"
              }`}
              style={{
                left: `${displayPos.displayX}px`,
                top: `${displayPos.displayY}px`,
                width: `${Math.max(widthPixels, 4)}px`,
                height: `${Math.max(heightPixels, 4)}px`,
                overflow: "visible",
                display: "flex",
                backgroundColor: ownedFillColor,
                border: "none",
                boxShadow: isSelected ? "0 0 0 2px #3b82f6" : undefined,
                zIndex: showNonOwnedTooltip ? 30 : isSelected ? 20 : 10,
                alignItems:
                  align_v === "middle"
                    ? "center"
                    : align_v === "bottom"
                      ? "flex-end"
                      : "flex-start",
                justifyContent:
                  align_h === "center" ? "center" : align_h === "right" ? "flex-end" : "flex-start",
              }}
            >
              {signatureImageSrc ? (
                <div
                  className="pointer-events-none absolute top-1/2 left-1/2 flex items-center justify-center"
                  style={{
                    width: `${Math.max(widthPixels * SIGNATURE_IMAGE_OVERFLOW_SCALE, 4)}px`,
                    height: `${Math.max(heightPixels * SIGNATURE_IMAGE_OVERFLOW_SCALE, 4)}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <img
                    src={signatureImageSrc}
                    alt="Signature"
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                </div>
              ) : isFilled ? (
                <div
                  className="text-black"
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: `${lineHeight}px`,
                    overflow: "hidden",
                    whiteSpace: shouldWrap ? "pre" : "nowrap",
                    wordWrap: "normal",
                    overflowWrap: "normal",
                    width: "100%",
                    maxWidth: "100%",
                    maxHeight: "100%",
                    padding: "0px",
                    margin: "0px",
                    boxSizing: "border-box",
                    textAlign: align_h === "center" ? "center" : align_h,
                    fontFamily: resolvedFont.cssFamily,
                    fontWeight: resolvedFont.fontWeight,
                    color: "#000000",
                  }}
                >
                  {displayLines.length > 0 ? displayLines.join("\n") : valueStr}
                </div>
              ) : null}
              {showNonOwnedTooltip ? (
                <AssignedOwnerTooltip ownerLabel={ownerMeta.ownerLabel} />
              ) : null}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};

const AssignedOwnerTooltip = ({ ownerLabel }: { ownerLabel: string }) => (
  <div className="pointer-events-none absolute -top-12 left-0 z-20 max-w-56 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-lg">
    <span className="break-words">
      Filled by <strong className="text-slate-900">{ownerLabel}</strong>
    </span>
  </div>
);
