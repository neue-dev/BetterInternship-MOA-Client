"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
  useEffect,
} from "react";
import type { FieldRegistryEntry } from "@/app/api";
import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";

const ZOOM_STORAGE_KEY = "form-editor-zoom";

function loadZoom(): number {
  if (typeof window === "undefined") return 1.1;
  try {
    const saved = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (saved) {
      const parsed = Number.parseFloat(saved);
      if (Number.isFinite(parsed) && parsed >= 0.3 && parsed <= 3) return parsed;
    }
  } catch {}
  return 1.1;
}

export interface FormEditorPdfViewerContextType {
  pdfDoc: PDFDocumentProxy | null;
  pageCount: number;
  selectedPage: number;
  setSelectedPage: (page: number) => void;
  visiblePage: number;
  setVisiblePage: (page: number) => void;
  scale: number;
  setScale: (scale: number) => void;
  isLoadingDoc: boolean;
  error: string | null;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  registry: FieldRegistryEntry[];
  setRegistry: (registry: FieldRegistryEntry[]) => void;
  handleFileUpload: (file: File) => void;
}

const FormEditorPdfViewerContext = createContext<FormEditorPdfViewerContextType | undefined>(
  undefined
);

export function FormEditorPdfViewerProvider({ children }: { children: ReactNode }) {
  const { setDocumentFile, pdfDoc, pageCount, isPdfLoading, pdfError } = useFormEditorMetadata();

  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [visiblePage, setVisiblePage] = useState<number>(1);
  const [scale, setScale] = useState<number>(loadZoom);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [registry, setRegistry] = useState<FieldRegistryEntry[]>([]);

  const handleFileUpload = useCallback((file: File) => setDocumentFile(file), [setDocumentFile]);

  useEffect(() => {
    if (pdfDoc) {
      setSelectedPage(1);
      setVisiblePage(1);
    }
  }, [pdfDoc]);

  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(scale));
    } catch {}
  }, [scale]);

  const value = useMemo(
    () => ({
      pdfDoc,
      pageCount,
      selectedPage,
      setSelectedPage,
      visiblePage,
      setVisiblePage,
      scale,
      setScale,
      isLoadingDoc: isPdfLoading,
      error: pdfError,
      isDragging,
      setIsDragging,
      registry,
      setRegistry,
      handleFileUpload,
    }),
    [
      pdfDoc,
      pageCount,
      isPdfLoading,
      pdfError,
      selectedPage,
      visiblePage,
      scale,
      isDragging,
      registry,
      handleFileUpload,
    ]
  );

  return (
    <FormEditorPdfViewerContext.Provider value={value}>
      {children}
    </FormEditorPdfViewerContext.Provider>
  );
}

export function useFormEditorPdfViewer() {
  const context = useContext(FormEditorPdfViewerContext);
  if (!context) {
    throw new Error("usePdfViewer must be used within PdfViewerProvider");
  }
  return context;
}
