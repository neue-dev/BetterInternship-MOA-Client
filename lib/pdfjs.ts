/**
 * Shared PDF.js wrapper — handles worker setup and document loading.
 * 
 * All PDF pages/modules should import from here instead of calling pdfjs-dist directly.
 * So it separates pdfjs-dist API details from React components.
 */
import { GlobalWorkerOptions, getDocument, version as pdfjsVersion } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";

let workerInitialized = false;

/**
 * Sets up the CDN-based pdf.js web worker. Called once automatically.
 * Safe to call multiple times — the guard prevents re-initialization.
 */
export function setupPdfJsWorker() {
  if (typeof window === "undefined" || workerInitialized) return;
  const workerFile = pdfjsVersion.startsWith("4") ? "pdf.worker.min.mjs" : "pdf.worker.min.js";
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/${workerFile}`;
  workerInitialized = true;
}

/**
 * Loads a PDF from a user-selected File object.
 * Uses the modern File.arrayBuffer() API.
 * Returns a PDFDocumentProxy (pdfjs-dist document) ready for rendering.
 */
export async function loadPdfFromFile(file: File): Promise<PDFDocumentProxy> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: arrayBuffer });
  const doc = await loadingTask.promise;
  return doc;
}

/**
 * Loads a PDF from a URL string (e.g., an uploaded document URL).
 * Returns a PDFDocumentProxy ready for rendering.
 */
export async function loadPdfFromUrl(url: string): Promise<PDFDocumentProxy> {
  const loadingTask = getDocument({ url });
  const doc = await loadingTask.promise;
  return doc;
}
