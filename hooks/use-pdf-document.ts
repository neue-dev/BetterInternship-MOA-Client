/**
 * Shared React hooks for loading PDF documents.
 *
 * These hooks replace duplicated file-loading + error-handling + cleanup logic
 * that was previously spread across multiple components.
 *
 * Both hooks:
 *   1. Call setupPdfJsWorker() once.
 *   2. Load the document via lib/pdfjs.ts.
 *   3. Track loading/error state.
 *   4. Auto-cleanup the document on unmount.
 *   5. Deduplicate: same File object won't reload (editor tab-switch optimization).
 *
 * Return: { pdfDoc, pageCount, isLoading, error }
 *   - pdfDoc: null until loaded, then the PDFDocumentProxy
 *   - pageCount: 0 until loaded, then doc.numPages
 *   - isLoading: true while loading
 *   - error: null or error message string
 */
import { useState, useEffect, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { setupPdfJsWorker, loadPdfFromFile, loadPdfFromUrl } from "@/lib/pdfjs";

type UsePdfDocumentResult = {
  pdfDoc: PDFDocumentProxy | null;
  pageCount: number;
  isLoading: boolean;
  error: string | null;
};

/**
 * Loads a PDF from a File object (user upload).
 * Deduplicates by file identity so re-renders pass === check and skip reload.
 */
export function usePdfDocumentFromFile(file: File | null | undefined): UsePdfDocumentResult {
  const [state, setState] = useState<UsePdfDocumentResult>({
    pdfDoc: null,
    pageCount: 0,
    isLoading: false,
    error: null,
  });
  const loadedRef = useRef<File | null>(null);
  const destructorRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    setupPdfJsWorker();

    if (!file) {
      loadedRef.current = null;
      setState({ pdfDoc: null, pageCount: 0, isLoading: false, error: null });
      return;
    }
    if (loadedRef.current === file) return;
    loadedRef.current = file;

    let cancelled = false;
    setState({ pdfDoc: null, pageCount: 0, isLoading: true, error: null });

    loadPdfFromFile(file)
      .then((doc) => {
        if (cancelled) {
          void doc.destroy();
          return;
        }
        destructorRef.current = { destroy: () => void doc.destroy() };
        setState({ pdfDoc: doc, pageCount: doc.numPages, isLoading: false, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          pdfDoc: null,
          pageCount: 0,
          isLoading: false,
          error: (err as { message?: string })?.message ?? "Failed to load PDF",
        });
      });

    return () => {
      cancelled = true;
      loadedRef.current = null;
      destructorRef.current?.destroy();
      destructorRef.current = null;
      setState({ pdfDoc: null, pageCount: 0, isLoading: false, error: null });
    };
  }, [file]);

  return state;
}

/**
 * Loads a PDF from a URL string (e.g. form document URL).
 * Used by the read-only form previewer.
 */
export function usePdfDocumentFromUrl(url: string | null | undefined): UsePdfDocumentResult {
  const [state, setState] = useState<UsePdfDocumentResult>({
    pdfDoc: null,
    pageCount: 0,
    isLoading: false,
    error: null,
  });
  const destructorRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    setupPdfJsWorker();

    if (!url) {
      setState({ pdfDoc: null, pageCount: 0, isLoading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ pdfDoc: null, pageCount: 0, isLoading: true, error: null });

    loadPdfFromUrl(url)
      .then((doc) => {
        if (cancelled) {
          void doc.destroy();
          return;
        }
        destructorRef.current = { destroy: () => void doc.destroy() };
        setState({ pdfDoc: doc, pageCount: doc.numPages, isLoading: false, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          pdfDoc: null,
          pageCount: 0,
          isLoading: false,
          error: (err as { message?: string })?.message ?? "Failed to load PDF",
        });
      });

    return () => {
      cancelled = true;
      destructorRef.current?.destroy();
      destructorRef.current = null;
      setState({ pdfDoc: null, pageCount: 0, isLoading: false, error: null });
    };
  }, [url]);

  return state;
}
