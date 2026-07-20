/**
 * FormPreview
 *
 * Preview tab inside the form editor. Two modes:
 *
 * "preview" (default):
 *   Split-pane: form fields with dummy prefill on the left, PDF preview on the right.
 *   Has a "Generate Test Form" button to create a test document.
 *   Field state is isolated from the editor PDF via useFormPreviewEditing
 *   so that dragging blocks re-renders only this panel.
 *
 * "sort":
 *   Lists all fields organized by signing party — no PDF.
 *
 * Wraps everything in StaticFormRendererContextProvider + FormFillerContextProvider.
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FormMetadata,
  type IFormBlock,
  type IFormSigningParty,
  type IFormMetadata,
} from "@betterinternship/core/forms";
import { Button } from "@/components/ui/button";
import { FormPreviewRenderer } from "./FormPreviewRenderer";
import { FormFillPdfViewer } from "@betterinternship/core/pdf-viewer";
import { Loader2 } from "lucide-react";
import { formsControllerGenerateTestForm } from "@/app/api";
import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { useEditorViewSync } from "@/components/editor/tabs/editor-view-sync.context";
import { EditorSplitLayout } from "@/components/editor/tabs/EditorSplitLayout";
import { withDerivedFormValues } from "@/lib/derived-form-values";
import { DEFAULT_PREVIEW_DUMMY_STUDENT_USER } from "@betterinternship/core/pdf-viewer";
import { extractPrefillValues } from "./form-layout-utils";
import { useFormPreviewEditing } from "./useFormPreviewEditing";
import { StaticFormRendererContextProvider } from "@/components/docs/forms/form-renderer.ctx";
import { FormFillerContextProvider, useFormFiller } from "@/components/docs/forms/form-filler.ctx";
import { useSignedUrl } from "@/lib/signed-url";
import { expandRepeatedPreviewBlocks } from "@/lib/repeated-pdf-fields";

interface FormPreviewProps {
  metadata?: IFormMetadata;
  mode?: "preview" | "sort";
}

/**
 * Sort View - Display all fields organized by party
 */
const FormSortView = ({
  blocks,
  signingParties,
}: {
  blocks: IFormBlock[];
  signingParties: IFormSigningParty[];
}) => {
  const fieldsByParty = useMemo(() => {
    const grouped: Record<string, { party: IFormSigningParty; fields: IFormBlock[] }> = {};

    signingParties.forEach((party) => {
      grouped[party._id] = {
        party,
        fields: blocks.filter((b) => b.signing_party_id === party._id && b.field_schema?.field),
      };
    });

    return Object.values(grouped).sort((a, b) => a.party.order - b.party.order);
  }, [blocks, signingParties]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <div>
        <h2 className="text-lg font-semibold">Field Order by Party</h2>
        <p className="text-muted-foreground text-sm">Organize fields by signing party</p>
      </div>

      <div className="space-y-4">
        {fieldsByParty.map(({ party, fields }) => (
          <div key={party._id} className="space-y-2">
            <h3 className="text-foreground text-sm font-medium">{party.signatory_title}</h3>
            <div className="space-y-1 pl-2">
              {fields.length > 0 ? (
                fields.map((field) => (
                  <div
                    key={field._id}
                    className="border-border bg-secondary/30 rounded border-l-2 p-2 text-xs"
                  >
                    <p className="font-medium">
                      {field.field_schema?.label || field.field_schema?.field}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-xs italic">No fields assigned</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Center form panel. Owns the transient block-editing drag state (via
 * useFormPreviewEditing) so that dragging blocks around re-renders only this
 * panel — not the sibling PDF previewer, which is expensive to re-render.
 *
 * Field rendering and state are handled inside FormPreviewRenderer via the
 * StaticFormRendererContext + FormFillerContext installed by FormPreviewContent.
 */
const FormPreviewFormPanel = ({
  autoScrollToSelectedField,
  onFieldClick,
  generationResult,
  isGenerating,
  onGenerate,
  selectedPartyId,
}: {
  autoScrollToSelectedField: boolean;
  onFieldClick: (fieldId: string) => void;
  generationResult: string | null;
  isGenerating: boolean;
  onGenerate: () => void;
  selectedPartyId: string;
}) => {
  const editing = useFormPreviewEditing();

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-white">
      <div className="min-h-0 flex-1 overflow-hidden">
        <FormPreviewRenderer
          autoScrollToSelectedField={autoScrollToSelectedField}
          squareFrame
          editing={editing}
          hideTitle
          onFieldClick={onFieldClick}
          selectedPartyId={selectedPartyId}
        />
      </div>

      <div className="bg-background flex flex-shrink-0 items-center justify-end gap-2 border-t p-3">
        {generationResult && (
          <a
            href={generationResult}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-600 hover:underline"
          >
            Download
          </a>
        )}
        <Button onClick={onGenerate} disabled={isGenerating} size="sm" variant="default">
          {isGenerating && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          {isGenerating ? "Generating..." : "Generate Test PDF"}
        </Button>
      </div>
    </div>
  );
};

interface FormPreviewContentBodyProps {
  formMetadata: IFormMetadata;
  blocks: IFormBlock[];
  signingParties: IFormSigningParty[];
  documentUrl?: string | null;
  selectedPartyId: string;
  selectedFieldId: string | null;
  setSelectedFieldId: (id: string | null) => void;
  selectedFieldSource: "form" | "pdf" | null;
  setSelectedFieldSource: (s: "form" | "pdf" | null) => void;
}

/**
 * Inner consumer: reads values, errors, and field data from the
 * StaticFormRendererContext + FormFillerContext installed by FormPreviewContent.
 */
const FormPreviewContentBody = ({
  formMetadata,
  blocks,
  signingParties,
  documentUrl,
  selectedPartyId,
  selectedFieldId,
  setSelectedFieldId,
  selectedFieldSource,
  setSelectedFieldSource,
}: FormPreviewContentBodyProps) => {
  const formFiller = useFormFiller();
  const { registerPreviewScroller, previewScale, reportPreviewScale } = useEditorViewSync();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<string | null>(null);

  useEffect(() => {
    setSelectedFieldId(null);
    setSelectedFieldSource(null);
  }, [selectedPartyId]);

  // Hydrate preview values from configured field prefillers/defaults.
  // Keep existing values so manual edits in preview are not overwritten on party switch.
  useEffect(() => {
    try {
      const metadataClient = new FormMetadata(formMetadata);
      const partyFields = metadataClient.getFieldsForClientService(selectedPartyId);
      const prefilled = extractPrefillValues(partyFields, {
        existing: formFiller.getFinalValues(),
        skipExisting: true,
      });
      if (Object.keys(prefilled).length > 0) formFiller.initializeValues(prefilled);
    } catch (error) {
      console.error("Failed to hydrate preview default values:", error);
    }
  }, [formMetadata, selectedPartyId]);

  const previewValues = withDerivedFormValues(
    new FormMetadata(formMetadata),
    formFiller.getFinalValues()
  );
  const expandedPreviewBlocks = useMemo(
    () => expandRepeatedPreviewBlocks(blocks, previewValues),
    [blocks, previewValues]
  );

  const handleGenerateTestForm = useCallback(async () => {
    setIsGenerating(true);
    try {
      const metadataClient = new FormMetadata(formMetadata);
      const userValues = formFiller.getFinalValues();

      // Build dummy prefill values by running each field's prefiller with dummy student data
      const allClientFields = metadataClient.getFieldsForClientService(undefined);
      const dummyValues: Record<string, string> = {};
      for (const field of allClientFields) {
        if (typeof field.prefiller === "function") {
          try {
            const raw = field.prefiller({
              signatory: DEFAULT_PREVIEW_DUMMY_STUDENT_USER,
              user: DEFAULT_PREVIEW_DUMMY_STUDENT_USER,
            });
            if (raw != null) {
              dummyValues[field.field] = String(raw);
            }
          } catch {
            // skip failing prefillers in test mode
          }
        }
      }

      // Build test values: dummy prefill as base, overlay derived, overlay user edits
      const testValues = {
        ...dummyValues,
        ...withDerivedFormValues(metadataClient, { ...dummyValues, ...userValues }),
        ...userValues,
      };

      const result = await formsControllerGenerateTestForm({
        formName: formMetadata.name,
        values: testValues,
      });
      const url = result?.data?.documentUrl || result?.documentUrl;
      if (url) setGenerationResult(url);
    } catch (error) {
      console.error("Failed to generate test form", error);
    } finally {
      setIsGenerating(false);
    }
  }, [formFiller, formMetadata]);

  const handleFormFieldClick = useCallback(
    (fieldId: string) => {
      setSelectedFieldSource("form");
      setSelectedFieldId(fieldId);
    },
    [setSelectedFieldId, setSelectedFieldSource]
  );

  return (
    <EditorSplitLayout
      side="preview"
      left={
        <FormPreviewFormPanel
          autoScrollToSelectedField={selectedFieldSource === "pdf"}
          onFieldClick={handleFormFieldClick}
          generationResult={generationResult}
          isGenerating={isGenerating}
          onGenerate={handleGenerateTestForm}
          selectedPartyId={selectedPartyId}
        />
      }
      right={
        <div className="bg-secondary/30 flex h-full flex-col overflow-hidden">
          {documentUrl ? (
            <FormFillPdfViewer
              documentUrl={documentUrl}
              blocks={expandedPreviewBlocks}
              values={previewValues}
              scale={previewScale}
              onScaleChange={reportPreviewScale}
              registerScrollContainer={registerPreviewScroller}
              onFieldClick={(fieldId) => {
                setSelectedFieldSource("pdf");
                setSelectedFieldId(fieldId);
              }}
              selectedFieldId={selectedFieldId || undefined}
              autoScrollToSelectedField={selectedFieldSource === "form"}
              signingParties={signingParties}
              currentSigningPartyId={selectedPartyId}
              showOwnership
              fieldVisibility="all"
              defaultFieldVisibility="all"
              prefillMode="dummy"
              prefillUser={DEFAULT_PREVIEW_DUMMY_STUDENT_USER}
              squareFrame
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground text-sm">Upload a PDF to preview</p>
              </div>
            </div>
          )}
        </div>
      }
    />
  );
};

/**
 * Preview Content - provides the StaticFormRendererContext + FormFillerContext
 * so both FormPreviewRenderer and FormPreviewContentBody share the same context
 * interface as the live sign route.
 */
const FormPreviewContent = ({
  formMetadata,
  blocks,
  signingParties,
  documentUrl,
}: {
  formMetadata: IFormMetadata;
  blocks: IFormBlock[];
  signingParties: IFormSigningParty[];
  documentUrl?: string | null;
}) => {
  const { selectedPartyId: ctxPartyId } = useEditorSelection();
  const selectedPartyId = ctxPartyId || signingParties[0]._id;
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedFieldSource, setSelectedFieldSource] = useState<"form" | "pdf" | null>(null);

  return (
    <StaticFormRendererContextProvider
      formName={formMetadata.name}
      formLabel={formMetadata.label}
      formMetadata={formMetadata}
      signingPartyId={selectedPartyId}
      selectedPreviewId={selectedFieldId}
      onSelectedPreviewId={setSelectedFieldId}
    >
      <FormFillerContextProvider>
        <FormPreviewContentBody
          formMetadata={formMetadata}
          blocks={blocks}
          signingParties={signingParties}
          documentUrl={documentUrl}
          selectedPartyId={selectedPartyId}
          selectedFieldId={selectedFieldId}
          setSelectedFieldId={setSelectedFieldId}
          selectedFieldSource={selectedFieldSource}
          setSelectedFieldSource={setSelectedFieldSource}
        />
      </FormFillerContextProvider>
    </StaticFormRendererContextProvider>
  );
};

export const FormPreview = ({ metadata, mode = "preview" }: FormPreviewProps) => {
  const { formMetadata, documentUrl, documentFile } = useFormEditorMetadata();
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);

  // Convert file to data URL
  useEffect(() => {
    if (!documentFile) {
      setFileDataUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") {
        setFileDataUrl(e.target.result);
      }
    };
    reader.readAsDataURL(documentFile);
  }, [documentFile]);

  const { url: resolvedDocumentUrl } = useSignedUrl(documentUrl ?? "");
  const actualMetadata = metadata || formMetadata;
  const actualBlocks = (actualMetadata?.schema as any)?.blocks || [];
  const actualSigningParties = actualMetadata?.signing_parties || [];
  const actualDocumentUrl = resolvedDocumentUrl || fileDataUrl;

  if (!actualMetadata) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading form...</p>
      </div>
    );
  }

  if (mode === "sort") {
    return <FormSortView blocks={actualBlocks} signingParties={actualSigningParties} />;
  }

  if (!actualSigningParties?.length) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">No signing parties configured</p>
      </div>
    );
  }

  return (
    <FormPreviewContent
      formMetadata={actualMetadata}
      blocks={actualBlocks}
      signingParties={actualSigningParties}
      documentUrl={actualDocumentUrl}
    />
  );
};
