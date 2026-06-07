/**
 * Base PDF viewer shell — shared between the form editor and form fill-out view.
 *
 * Owns:
 *   - Toolbar with page count + zoom controls
 *   - Scrollable page container with scroll-to-page tracking
 *   - Children slot in toolbar for viewer-specific controls (e.g. PDF tools, undo/redo)
 *   - renderPage callback for page-specific content (field overlays, etc.)
 *   - Optional drag handlers (editor uses these for field drops)
 *
 * Does NOT handle:
 *   - PDF loading (parent should use usePdfDocumentFromFile/Url and pass pdfDoc)
 *   - Loading/error/empty states (parent handles these)
 *   - Field overlays (handled by renderPage)
 */
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { FileUp, ZoomIn, ZoomOut } from "lucide-react";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

type BasePdfViewerProps = {
  pdfDoc: PDFDocumentProxy;
  pageCount: number;
  scale: number;
  onScaleChange: (scale: number) => void;
  visiblePage: number;
  onVisiblePageChange: (page: number) => void;
  showToolbar?: boolean;
  squareFrame?: boolean;
  children?: React.ReactNode;
  renderPage: (pageNumber: number) => React.ReactNode;
  pageRefs?: React.MutableRefObject<Map<number, HTMLDivElement | null>>;
  registerScrollContainer?: (el: HTMLElement | null) => void;
  onFileChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
};

export function BasePdfViewer({
  pdfDoc,
  pageCount,
  scale,
  onScaleChange,
  visiblePage,
  onVisiblePageChange,
  showToolbar = true,
  squareFrame = false,
  children,
  renderPage,
  registerScrollContainer,
  onFileChange,
  pageRefs: externalPageRefs,
  onDragOver,
  onDragLeave,
  onDrop,
}: BasePdfViewerProps) {
  const internalPageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const pageRefs = externalPageRefs ?? internalPageRefs;

  const registerPageRef = useCallback((page: number, node: HTMLDivElement | null) => {
    pageRefs.current.set(page, node);
  }, []);

  const handleZoom = (direction: "in" | "out") => {
    const delta = direction === "in" ? 0.1 : -0.1;
    onScaleChange(clamp(parseFloat((scale + delta).toFixed(2)), 0.5, 3));
  };

  const pagesArray = useMemo(
    () => Array.from({ length: pageCount }, (_, idx) => idx + 1),
    [pageCount]
  );

  const handleScroll = useCallback(
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
        onVisiblePageChange(closestPage);
      }
    },
    [pagesArray, onVisiblePageChange, visiblePage]
  );

  const containerClass = squareFrame
    ? "relative flex h-full flex-col overflow-hidden bg-slate-50"
    : "relative flex h-full flex-col overflow-hidden rounded-[0.33em] bg-slate-50";

  return (
    <div className={containerClass}>
      {/* Toolbar */}
      {showToolbar && (
      <div className="relative flex h-12 flex-shrink-0 items-center border-b border-slate-300 bg-white px-3">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-1">{children}</div>
          <div className="flex items-center gap-2">
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
            {onFileChange && (
              <label
                className="flex cursor-pointer items-center rounded p-1.5 text-sm transition-colors hover:bg-slate-100"
                title="Upload PDF"
                aria-label="Upload PDF"
              >
                <FileUp className="h-4 w-4" />
                <input type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
              </label>
            )}
          </div>
        </div>
      </div>
      )}
      {/* Page area */}
      <div className="relative flex-1 overflow-hidden bg-white">
        <div className="flex h-full min-w-0">
          <div
            ref={registerScrollContainer}
            className="relative min-w-0 flex-1 overflow-auto p-4"
            onScroll={handleScroll}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="flex w-full flex-col items-center gap-4">
              {pagesArray.map((page) => (
                <div
                  key={page}
                  ref={(node) => registerPageRef(page, node)}
                >
                  {renderPage(page)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
