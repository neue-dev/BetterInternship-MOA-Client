"use client";

import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { usePdfPageRenderer, usePdfDocumentFromFile } from "@betterinternship/core/pdf-viewer";
import { Loader } from "@/components/ui/loader";

function PreviewPage({
  pdf,
  pageNumber,
  scale,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}) {
  const { canvasRef, pageReady } = usePdfPageRenderer(pdf, pageNumber, scale);
  return (
    <div
      className="relative inline-block overflow-hidden rounded-[0.33em] border border-slate-200 bg-white shadow-sm"
      style={{ visibility: pageReady ? "visible" : "hidden" }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}

interface PdfFilePreviewProps {
  file: File;
  /** Render scale for the page. Smaller = more compact. */
  scale?: number;
}

export function PdfFilePreview({ file, scale = 0.7 }: PdfFilePreviewProps) {
  const { pdfDoc, isLoading, error } = usePdfDocumentFromFile(file);

  if (error) {
    return (
      <div className="flex h-28 items-center justify-center text-xs text-red-500">
        Failed to load PDF preview
      </div>
    );
  }

  if (isLoading || !pdfDoc) {
    return (
      <div className="flex h-28 items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-slate-100 p-3">
      <PreviewPage pdf={pdfDoc} pageNumber={1} scale={scale} />
    </div>
  );
}
