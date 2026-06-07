/**
 * Shared React hook for rendering a single PDF page to a canvas element.
 *
 * Used by the editor (PdfPageCanvas), the create-form PDF preview, and the
 * read-only form previewer. Replaces the duplicated inline render logic.
 *
 * To use:
 *   const { canvasRef, rendering } = usePdfPageRenderer(pdfDoc, pageNumber, scale)
 *   // ... <canvas ref={canvasRef} /> ...
 *   // {rendering && <LoadingOverlay />}
 *
 * Also exports viewportRef for coordinate transforms (used by use-pdf-coordinate-transform
 * in the editor). The `previewer.tsx` does NOT need viewport transforms — its fields are
 * positioned with simple `pdfX * scale` multiplication.
 */
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist/types/src/display/api";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";

export function usePdfPageRenderer(pdf: PDFDocumentProxy, pageNumber: number, scale: number) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<PageViewport | null>(null);
  const [rendering, setRendering] = useState<boolean>(false);

  useEffect(() => {
    let renderTask: RenderTask | null = null;
    let cancelled = false;
    if (!pdf) return;
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

  return { canvasRef, viewportRef, rendering };
}
