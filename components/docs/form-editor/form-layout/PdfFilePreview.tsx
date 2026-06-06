/**
 * @ Author: BetterInternship
 * @ Description: Lightweight, chrome-less PDF preview for a local File. Renders the
 *   first page straight to a canvas via the editor's usePdfPageRenderer hook (no native
 *   PDF viewer toolbar/sidebar). Used by the create-form wizard to preview the uploaded
 *   document.
 */

"use client";

import { useEffect, useState } from "react";
import { GlobalWorkerOptions, getDocument, version as pdfjsVersion } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { usePdfPageRenderer } from "@/components/docs/form-editor/form-pdf-editor/use-pdf-page-renderer";
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
  const { canvasRef, rendering } = usePdfPageRenderer(pdf, pageNumber, scale);
  return (
    <div className="relative inline-block overflow-hidden rounded-[0.33em] border border-slate-200 bg-white shadow-sm">
      <canvas ref={canvasRef} className="block" />
      {rendering && (
        <div className="text-muted-foreground absolute inset-0 flex items-center justify-center bg-white/70 text-xs">
          Rendering…
        </div>
      )}
    </div>
  );
}

interface PdfFilePreviewProps {
  file: File;
  /** Render scale for the page. Smaller = more compact. */
  scale?: number;
}

export function PdfFilePreview({ file, scale = 0.7 }: PdfFilePreviewProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set up the PDF.js worker once (same source the editor/previewer use).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const workerFile = pdfjsVersion.startsWith("4") ? "pdf.worker.min.mjs" : "pdf.worker.min.js";
    GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/${workerFile}`;
  }, []);

  // Parse the File into a PDF document.
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof getDocument> | null = null;

    setPdf(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const buf = e.target?.result;
      if (!buf || typeof buf === "string") return;
      task = getDocument({ data: buf });
      task.promise
        .then((doc) => {
          if (!cancelled) setPdf(doc);
        })
        .catch((err) => {
          if (!cancelled) {
            setError((err as { message?: string })?.message ?? "Failed to load PDF");
          }
        });
    };
    reader.readAsArrayBuffer(file);

    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [file]);

  if (error) {
    return (
      <div className="flex h-28 items-center justify-center text-xs text-red-500">
        Failed to load PDF preview
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className="flex h-28 items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-slate-100 p-3">
      <PreviewPage pdf={pdf} pageNumber={1} scale={scale} />
    </div>
  );
}
