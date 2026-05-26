"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { getDocument } from "pdfjs-dist";
import type { FieldRegistryEntry } from "@/app/api";
import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";

export interface FormEditorPdfViewerContextType {
  // PDF document state
  pdfDoc: PDFDocumentProxy | null;
  pageCount: number;
  selectedPage: number;
  setSelectedPage: (page: number) => void;
  visiblePage: number;
  setVisiblePage: (page: number) => void;

  // UI state
  scale: number;
  setScale: (scale: number) => void;
  isLoadingDoc: boolean;
  error: string | null;

  // Dragging state
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;

  // Field registry and placement
  registry: FieldRegistryEntry[];
  setRegistry: (registry: FieldRegistryEntry[]) => void;

  // File upload handler
  handleFileUpload: (file: File) => void;
}

const FormEditorPdfViewerContext = createContext<FormEditorPdfViewerContextType | undefined>(
  undefined
);

/**
 * Renders the working PDF. Reads `documentFile` straight from the form document
 * provider (no prop proxy) and loads it through a single identity-keyed path:
 * a given File object is parsed once, so save/refetch that keep the same File do
 * not trigger a reload. Hoisted above the tab switch, so the parsed document
 * survives tab changes.
 */
export function FormEditorPdfViewerProvider({ children }: { children: ReactNode }) {
  const { documentFile, setDocumentFile } = useFormEditorMetadata();

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [visiblePage, setVisiblePage] = useState<number>(1);

  const [scale, setScale] = useState<number>(1.1);
  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState<boolean>(false);

  const [registry, setRegistry] = useState<FieldRegistryEntry[]>([]);

  const loadingTaskRef = useRef<any>(null);
  // The File object we have already parsed; identity (not name) drives dedup.
  const loadedFileRef = useRef<File | null>(null);

  // Sets the working file on the form document; the load effect below picks it up.
  const handleFileUpload = useCallback((file: File) => setDocumentFile(file), [setDocumentFile]);

  useEffect(() => {
    if (!documentFile) {
      loadedFileRef.current = null;
      return;
    }
    if (loadedFileRef.current === documentFile) return;
    loadedFileRef.current = documentFile;

    setIsLoadingDoc(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result;
      if (!arrayBuffer || typeof arrayBuffer === "string") {
        setIsLoadingDoc(false);
        return;
      }
      const loadingTask = getDocument({ data: arrayBuffer });
      loadingTaskRef.current = loadingTask;
      loadingTask.promise
        .then((doc) => {
          setPdfDoc(doc);
          setPageCount(doc.numPages);
          setSelectedPage(1);
          setVisiblePage(1);
          setError(null);
        })
        .catch((err: any) => {
          console.error("Failed to load PDF", err);
          setError((err as { message?: string })?.message ?? "Failed to load PDF document");
          setPdfDoc(null);
          setPageCount(0);
        })
        .finally(() => {
          setIsLoadingDoc(false);
        });
    };
    reader.readAsArrayBuffer(documentFile);
  }, [documentFile]);

  useEffect(() => {
    return () => {
      if (loadingTaskRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        loadingTaskRef.current.destroy();
      }
    };
  }, []);

  const value: FormEditorPdfViewerContextType = useMemo(
    () => ({
      pdfDoc,
      pageCount,
      selectedPage,
      setSelectedPage,
      visiblePage,
      setVisiblePage,
      scale,
      setScale,
      isLoadingDoc,
      error,
      isDragging,
      setIsDragging,
      registry,
      setRegistry,
      handleFileUpload,
    }),
    [
      pdfDoc,
      pageCount,
      selectedPage,
      visiblePage,
      scale,
      isLoadingDoc,
      error,
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
