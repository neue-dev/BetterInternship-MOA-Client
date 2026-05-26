/**
 * @ Author: BetterInternship
 * @ Description: Main form editor page. Bootstraps the document, then mounts the
 *   editor providers (document > selection > pdf) once around the editor UI.
 */

"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader } from "@/components/ui/loader";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { useFormsControllerGetLatestFormDocumentAndMetadata } from "@/app/api";
import { BLANK_FORM_METADATA } from "@betterinternship/core/forms";
import { FormEditorMetadataProvider, useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import { EditorSelectionProvider } from "@/app/contexts/editor-selection.context";
import { FormEditorPdfViewerProvider } from "@/app/contexts/pdf-viewer.context";
import { EditorToolbar } from "@/components/editor/toolbar/EditorToolbar";
import { EditorContent } from "@/components/editor/tabs/EditorContent";

function FormEditorLoadingFallback({ label = "Loading editor..." }: { label?: string }) {
  return (
    <div className="bg-background flex h-full min-h-0 w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader />
        <p className="text-muted-foreground text-sm">{label}</p>
      </div>
    </div>
  );
}

function FormEditorContent() {
  const searchParams = useSearchParams();
  const formName = searchParams.get("form_name");
  const { setFormMetadata, setFormDocument, setFormVersion, setDocumentUrl, setDocumentFile } =
    useFormEditorMetadata();
  const [isLoading, setIsLoading] = useState(true);
  const hasBootstrappedRef = useRef(false);
  const activeFormNameRef = useRef<string | null>(null);

  const { data: fetchedData } = useFormsControllerGetLatestFormDocumentAndMetadata({
    name: formName || "",
  });

  // Seeds editor state from the API response and, on the first load of a form,
  // fetches the latest PDF blob into `documentFile`. On save/refetch the existing
  // in-memory file is kept so the PDF viewer does not reload or flicker.
  useEffect(() => {
    const formChanged = activeFormNameRef.current !== formName;
    if (formChanged) {
      activeFormNameRef.current = formName;
      hasBootstrappedRef.current = false;
      setIsLoading(true);
    }

    // For existing forms, wait for the first payload before leaving loading state.
    if (formName && !fetchedData?.formMetadata) return;

    const isInitialBootstrap = !hasBootstrappedRef.current;

    try {
      if (formName && fetchedData?.formMetadata) {
        setFormMetadata(fetchedData.formMetadata);
        setFormDocument(fetchedData.formTemplate || null);
        setFormVersion(fetchedData.formVersion || null);
        setDocumentUrl(fetchedData.documentUrl || null);

        if (isInitialBootstrap && fetchedData.documentUrl) {
          fetch(fetchedData.documentUrl)
            .then((res) => {
              if (!res.ok) {
                throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText}`);
              }
              return res.blob();
            })
            .then((blob) => {
              const file = new File([blob], `${formName}.pdf`, { type: "application/pdf" });
              setDocumentFile(file);
            })
            .catch((err) => {
              console.error("Failed to fetch PDF:", err);
            })
            .finally(() => {
              setIsLoading(false);
              hasBootstrappedRef.current = true;
            });
        } else if (isInitialBootstrap) {
          // Metadata-only form (no base document yet).
          setIsLoading(false);
          hasBootstrappedRef.current = true;
        }
      } else if (isInitialBootstrap) {
        // Create-new form path: seed blank metadata.
        setFormMetadata(BLANK_FORM_METADATA);
        setFormDocument(null);
        setFormVersion(null);
        setDocumentUrl(null);
        setIsLoading(false);
        hasBootstrappedRef.current = true;
      }
    } catch (error) {
      console.error("Error loading form:", error);
      toast.error("Failed to load form", toastPresets.destructive);
      setFormMetadata(BLANK_FORM_METADATA);
      setFormDocument(null);
      setFormVersion(null);
      setDocumentUrl(null);
      setIsLoading(false);
      hasBootstrappedRef.current = true;
    }
  }, [formName, fetchedData]);

  if (isLoading) {
    return <FormEditorLoadingFallback label="Loading form..." />;
  }

  return (
    <EditorSelectionProvider>
      <FormEditorPdfViewerProvider>
        <div className="flex h-full w-full flex-col overflow-hidden">
          <EditorToolbar />
          <div className="flex flex-1 overflow-hidden">
            <EditorContent />
          </div>
        </div>
      </FormEditorPdfViewerProvider>
    </EditorSelectionProvider>
  );
}

export default function FormEditorPage() {
  return (
    <Suspense fallback={<FormEditorLoadingFallback />}>
      <FormEditorMetadataProvider>
        <FormEditorContent />
      </FormEditorMetadataProvider>
    </Suspense>
  );
}
