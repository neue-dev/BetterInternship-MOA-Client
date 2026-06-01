/**
 * @ Author: BetterInternship
 * @ Description: Main form editor page. Bootstraps the document, then mounts the
 *   editor providers (document > selection > pdf) once around the editor UI.
 */

"use client";

import { useEffect, useRef, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader } from "@/components/ui/loader";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { useFormsControllerGetLatestFormDocumentAndMetadata } from "@/app/api";
import { useFormDraft } from "@/app/contexts/form-draft.context";
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
  const router = useRouter();
  const draft = useFormDraft();
  const searchParams = useSearchParams();
  const formName = searchParams.get("form_name");
  const {
    loadFormMetadata,
    setFormDocument,
    setFormVersion,
    setDocumentUrl,
    setDocumentFile,
    undo,
    redo,
  } = useFormEditorMetadata();
  const [isLoading, setIsLoading] = useState(true);
  const hasBootstrappedRef = useRef(false);
  const activeFormNameRef = useRef<string | null>(null);
  const readySignaledRef = useRef(false);

  // The editor requires a form to edit. Without `form_name` there is nothing to
  // load, so send the user to the create-form wizard before any editor UI mounts.
  useEffect(() => {
    if (!formName) router.replace("./create-form");
  }, [formName, router]);

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
        loadFormMetadata(fetchedData.formMetadata);
        setFormDocument(fetchedData.formTemplate || null);
        setFormVersion(fetchedData.formVersion || null);
        setDocumentUrl(fetchedData.documentUrl || null);

        if (isInitialBootstrap && draft.formName === formName && draft.pdfFile) {
          // Freshly created via the wizard: reuse the PDF the user already uploaded
          // instead of re-downloading it. Metadata still comes from the API above.
          setDocumentFile(draft.pdfFile);
          setIsLoading(false);
          hasBootstrappedRef.current = true;
        } else if (isInitialBootstrap && fetchedData.documentUrl) {
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
      }
    } catch (error) {
      console.error("Error loading form:", error);
      toast.error("Failed to load form", toastPresets.destructive);
      setIsLoading(false);
      hasBootstrappedRef.current = true;
    }
  }, [formName, fetchedData]);

  // Once the editor has finished its initial bootstrap, signal the create-form overlay
  // (if any) to fade out, revealing the loaded editor behind it. Fires once.
  useEffect(() => {
    if (!isLoading && hasBootstrappedRef.current && !readySignaledRef.current) {
      readySignaledRef.current = true;
      draft.markEditorReady();
    }
  }, [isLoading, draft]);

  // Editor-scoped undo/redo; ignored when focus is inside a text input.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      )
        return;
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        redo();
      }
    },
    [undo, redo]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // No form to edit: render only the loader while the redirect to create-form runs.
  if (!formName || isLoading) {
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
