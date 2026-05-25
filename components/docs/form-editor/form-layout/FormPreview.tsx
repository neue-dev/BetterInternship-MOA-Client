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
import { FormPreviewPdfDisplay } from "@/components/docs/forms/previewer";
import { Loader2 } from "lucide-react";
import { formsControllerGenerateTestForm } from "@/app/api";
import { useFormEditor } from "@/app/contexts/form-editor.context";
import { useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import { withDerivedFormValues } from "@/lib/derived-form-values";
import { RecipientTabBar } from "@/components/docs/form-editor/RecipientTabBar";
import { DEFAULT_PREVIEW_DUMMY_STUDENT_USER } from "@/lib/form-previewer-model";
import { Switch } from "@/components/ui/switch";
import { filterBlocksByParty, extractPrefillValues } from "./form-layout-utils";
import { useFormPreviewEditing } from "./useFormPreviewEditing";
import { motion } from "framer-motion";

interface FormPreviewProps {
  metadata?: IFormMetadata;
  mode?: "preview" | "sort";
  showRecipientTabBar?: boolean;
  animatePanels?: boolean;
}

type AnimatedPreviewPanelProps = {
  animatePanels?: boolean;
  children: React.ReactNode;
  className: string;
  order: number;
};

const PREVIEW_PANEL_STAGGER_SECONDS = 0.07;
const PREVIEW_PANEL_TRANSITION_SECONDS = 0.2;

function AnimatedPreviewPanel({
  animatePanels = false,
  children,
  className,
  order,
}: AnimatedPreviewPanelProps) {
  if (!animatePanels) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: {
          delay: order * PREVIEW_PANEL_STAGGER_SECONDS,
          duration: PREVIEW_PANEL_TRANSITION_SECONDS,
          ease: "easeOut",
        },
      }}
      exit={{
        opacity: 0,
        y: 18,
        transition: {
          delay: order * PREVIEW_PANEL_STAGGER_SECONDS,
          duration: PREVIEW_PANEL_TRANSITION_SECONDS,
          ease: "easeIn",
        },
      }}
    >
      {children}
    </motion.div>
  );
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
 */
const FormPreviewFormPanel = ({
  animatePanels,
  formMetadata,
  filteredBlocks,
  values,
  onChange,
  selectedFieldId,
  autoScrollToSelectedField,
  onFieldClick,
  generationResult,
  isGenerating,
  onGenerate,
}: {
  animatePanels?: boolean;
  formMetadata: IFormMetadata;
  filteredBlocks: IFormBlock[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  selectedFieldId: string | null;
  autoScrollToSelectedField: boolean;
  onFieldClick: (fieldId: string) => void;
  generationResult: string | null;
  isGenerating: boolean;
  onGenerate: () => void;
}) => {
  const editing = useFormPreviewEditing();

  return (
    <AnimatedPreviewPanel
      animatePanels={animatePanels}
      className="flex min-w-0 flex-1 flex-col overflow-hidden border-r bg-white"
      order={0}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <FormPreviewRenderer
          formName={formMetadata.name}
          formLabel={formMetadata.label}
          blocks={filteredBlocks}
          values={values}
          onChange={onChange}
          metadata={formMetadata}
          selectedFieldId={selectedFieldId}
          autoScrollToSelectedField={autoScrollToSelectedField}
          squareFrame
          editing={editing}
          hideTitle
          onFieldClick={onFieldClick}
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
    </AnimatedPreviewPanel>
  );
};

/**
 * Preview Content - Main form and PDF preview
 */
const FormPreviewContent = ({
  formMetadata,
  blocks,
  signingParties,
  documentUrl,
  showRecipientTabBar = true,
  animatePanels = false,
}: {
  formMetadata: IFormMetadata;
  blocks: IFormBlock[];
  signingParties: IFormSigningParty[];
  documentUrl?: string | null;
  showRecipientTabBar?: boolean;
  animatePanels?: boolean;
}) => {
  const { selectedPartyId: ctxPartyId, setSelectedPartyId } = useFormEditorTab();
  const selectedPartyId = ctxPartyId || signingParties[0]._id;
  const [values, setValues] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedFieldSource, setSelectedFieldSource] = useState<"form" | "pdf" | null>(null);
  const [showAllPdfFields, setShowAllPdfFields] = useState(false);

  const filteredBlocks = useMemo(
    () => filterBlocksByParty(blocks, selectedPartyId),
    [blocks, selectedPartyId]
  );
  const previewValues = useMemo(
    () => withDerivedFormValues(new FormMetadata(formMetadata), values),
    [formMetadata, values]
  );

  // Hydrate preview values from configured field prefillers/defaults.
  // Keep existing values so manual edits in preview are not overwritten.
  useEffect(() => {
    setSelectedFieldId(null);
    setSelectedFieldSource(null);
  }, [selectedPartyId]);

  useEffect(() => {
    try {
      const metadataClient = new FormMetadata(formMetadata);
      const partyFields = metadataClient.getFieldsForClientService(selectedPartyId);
      setValues((prev) => {
        const prefilled = extractPrefillValues(partyFields, { existing: prev, skipExisting: true });
        return Object.keys(prefilled).length > 0 ? { ...prev, ...prefilled } : prev;
      });
    } catch (error) {
      console.error("Failed to hydrate preview default values:", error);
    }
  }, [formMetadata, selectedPartyId]);

  const handleGenerateTestForm = useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await formsControllerGenerateTestForm({
        formName: formMetadata.name,
        values,
      });
      const url = result?.data?.documentUrl || result?.documentUrl;
      if (url) setGenerationResult(url);
    } catch (error) {
      console.error("Failed to generate test form", error);
    } finally {
      setIsGenerating(false);
    }
  }, [formMetadata.name, values]);

  // Stable callbacks so the form panel (which owns transient drag state) does
  // not force the sibling PDF previewer to re-render on every drag move.
  const handleFormValueChange = useCallback(
    (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value })),
    []
  );
  const handleFormFieldClick = useCallback((fieldId: string) => {
    setSelectedFieldSource("form");
    setSelectedFieldId(fieldId);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Form */}
        <FormPreviewFormPanel
          animatePanels={animatePanels}
          formMetadata={formMetadata}
          filteredBlocks={filteredBlocks}
          values={values}
          onChange={handleFormValueChange}
          selectedFieldId={selectedFieldId}
          autoScrollToSelectedField={selectedFieldSource === "pdf"}
          onFieldClick={handleFormFieldClick}
          generationResult={generationResult}
          isGenerating={isGenerating}
          onGenerate={handleGenerateTestForm}
        />

        {/* PDF Preview */}
        <AnimatedPreviewPanel
          animatePanels={animatePanels}
          className="bg-secondary/30 flex flex-1 flex-col overflow-hidden"
          order={1}
        >
          {showRecipientTabBar && (
            <RecipientTabBar
              parties={signingParties}
              selectedPartyId={selectedPartyId}
              onSelectParty={setSelectedPartyId}
            />
          )}
          <div className="flex-1 overflow-hidden">
            {documentUrl ? (
              <FormPreviewPdfDisplay
                documentUrl={documentUrl}
                blocks={blocks}
                values={previewValues}
                headerLeft={
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                    <span>Show all fields</span>
                    <Switch checked={showAllPdfFields} onCheckedChange={setShowAllPdfFields} />
                  </label>
                }
                onFieldClick={(fieldId) => {
                  setSelectedFieldSource("pdf");
                  setSelectedFieldId(fieldId);
                }}
                selectedFieldId={selectedFieldId || undefined}
                autoScrollToSelectedField={selectedFieldSource === "form"}
                signingParties={signingParties}
                currentSigningPartyId={selectedPartyId}
                showOwnership
                fieldVisibility={showAllPdfFields ? "all" : "mine"}
                defaultFieldVisibility="mine"
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
        </AnimatedPreviewPanel>
      </div>
    </div>
  );
};

export const FormPreview = ({
  metadata,
  mode = "preview",
  showRecipientTabBar = true,
  animatePanels = false,
}: FormPreviewProps) => {
  const { formMetadata, documentUrl, documentFile } = useFormEditor();
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

  const actualMetadata = metadata || formMetadata;
  const actualBlocks = (actualMetadata?.schema as any)?.blocks || [];
  const actualSigningParties = actualMetadata?.signing_parties || [];
  const actualDocumentUrl = documentUrl || fileDataUrl;

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
      showRecipientTabBar={showRecipientTabBar}
      animatePanels={animatePanels}
    />
  );
};
