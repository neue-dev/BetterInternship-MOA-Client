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
  const [scale, setScale] = useState<number>(1.1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [registry, setRegistry] = useState<FieldRegistryEntry[]>([]);

  const handleFileUpload = useCallback((file: File) => setDocumentFile(file), [setDocumentFile]);

  useEffect(() => {
    if (pdfDoc) {
      setSelectedPage(1);
      setVisiblePage(1);
    }
  }, [pdfDoc]);

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
