import { RefObject } from "react";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";

export type PointerLocation = {
  page: number;
  pdfX: number;
  pdfY: number;
  displayX: number;
  displayY: number;
  viewportWidth: number;
  viewportHeight: number;
};

export function usePdfCoordinateTransform(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  viewportRef: RefObject<PageViewport | null>,
  scale: number,
  pageNumber: number
) {
  const extractLocation = (
    event: React.MouseEvent<HTMLCanvasElement, MouseEvent> | React.DragEvent<HTMLCanvasElement>
  ): PointerLocation | null => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return null;

    const rect = canvas.getBoundingClientRect();
    const containerRect = canvas.parentElement?.getBoundingClientRect();
    if (!containerRect) return null;

    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    const displayX = event.clientX - containerRect.left;
    const displayY = event.clientY - containerRect.top;

    const viewportX = (cssX / rect.width) * viewport.width;
    const viewportY = (cssY / rect.height) * viewport.height;

    const [pdfX, pdfYBottom] = viewport.convertToPdfPoint(viewportX, viewportY) as [
      number,
      number,
    ];

    const actualPdfHeight = viewport.height / scale;
    const pdfY = actualPdfHeight - pdfYBottom;

    return {
      page: pageNumber,
      pdfX,
      pdfY,
      displayX,
      displayY,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    };
  };

  // Inverse of extractLocation: convert PDF coords to display position relative to the page container.
  const pdfToDisplay = (pdfX: number, pdfY: number) => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return null;

    const rect = canvas.getBoundingClientRect();
    const containerRect = canvas.parentElement?.getBoundingClientRect();
    if (!containerRect) return null;

    const actualPdfHeight = viewport.height / scale;
    const pdfYBottom = actualPdfHeight - pdfY;

    const viewportPoint = viewport.convertToViewportPoint(pdfX, pdfYBottom);
    if (!viewportPoint) return null;
    const [viewportX, viewportY] = viewportPoint as [number, number];

    const cssX = (viewportX / viewport.width) * rect.width;
    const cssY = (viewportY / viewport.height) * rect.height;

    return {
      displayX: rect.left - containerRect.left + cssX,
      displayY: rect.top - containerRect.top + cssY,
    };
  };

  // Convert drag deltas from CSS display pixels to PDF coordinate space.
  const displayDeltaToPdfDelta = (displayDeltaX: number, displayDeltaY: number) => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return { pdfDeltaX: 0, pdfDeltaY: 0 };

    const rect = canvas.getBoundingClientRect();

    const viewportDeltaX = (displayDeltaX / rect.width) * viewport.width;
    const viewportDeltaY = (displayDeltaY / rect.height) * viewport.height;

    const pdfDeltaX = viewportDeltaX / scale;
    const pdfDeltaY = viewportDeltaY / scale;

    return { pdfDeltaX, pdfDeltaY };
  };

  return { extractLocation, pdfToDisplay, displayDeltaToPdfDelta };
}
