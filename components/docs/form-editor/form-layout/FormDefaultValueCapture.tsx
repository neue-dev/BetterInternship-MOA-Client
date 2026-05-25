"use client";

import { useState, useEffect, useMemo } from "react";
import { type IFormBlock, type IFormMetadata } from "@betterinternship/core/forms";
import { Button } from "@/components/ui/button";
import { FormPreviewRenderer } from "./FormPreviewRenderer";
import { FormPreviewPdfDisplay } from "@/components/docs/forms/previewer";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { FormMetadata } from "@betterinternship/core/forms";
import { FormFillerContextProvider, useFormFiller } from "@/components/docs/forms/form-filler.ctx";
import { useMyAutofill } from "@/hooks/use-my-autofill";
import { withDerivedFormValues } from "@/lib/derived-form-values";
import { DEFAULT_PREVIEW_DUMMY_STUDENT_USER } from "@/lib/form-previewer-model";
import { filterBlocksByParty, extractPrefillValues } from "./form-layout-utils";
import { MobileStepTabs } from "@/app/docs/sign/components/MobileStepTabs";
import { useIsMobile } from "@/hooks/use-mobile";

interface FormDefaultValueCaptureProps {
  formName: string;
  documentUrl?: string;
  metadata?: IFormMetadata;
  onSave?: (values: Record<string, string>) => Promise<void>;
  selectedPartyId: string;
}

/**
 * Inner component that uses form filler context
 */
const FormDefaultValueCaptureContent = ({
  formName,
  documentUrl,
  metadata,
  onSave,
  selectedPartyId,
}: FormDefaultValueCaptureProps) => {
  const formFiller = useFormFiller();
  const autofillValues = useMyAutofill();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [mobileFieldsTab, setMobileFieldsTab] = useState<"template" | "preview">("template");

  // Get blocks from metadata
  const blocks = (metadata?.schema?.blocks || []) as IFormBlock[];

  // Get fields from metadata for the selected party
  const formMetadata = metadata ? new FormMetadata(metadata) : null;
  const fields = formMetadata?.getFieldsForClientService(selectedPartyId) || [];
  const previewValues = useMemo(
    () => withDerivedFormValues(formMetadata, formFiller.getFinalValues()),
    [formMetadata, formFiller, autofillValues]
  );

  // Initialize values from metadata AND prefiller on load
  useEffect(() => {
    if (!formMetadata || !selectedPartyId) return;

    const initialValues: Record<string, string> = {};

    // First, add default values from metadata
    const defaultValues = metadata?.schema?.blocks
      ?.filter((b) => b.block_type === "form_field")
      .reduce(
        (acc, block) => {
          if (block.field_schema?.default_value) {
            acc[block.field_schema.field] = block.field_schema.default_value;
          }
          return acc;
        },
        {} as Record<string, string>
      );

    if (defaultValues) {
      Object.assign(initialValues, defaultValues);
    }

    // Then, add values from prefiller (prefiller takes precedence)
    Object.assign(initialValues, extractPrefillValues(fields, { trim: true }));

    // Finally, add autofill values (autofill takes highest precedence)
    if (autofillValues) {
      Object.assign(initialValues, autofillValues);
    }

    // Set all values in formFiller at once
    if (Object.keys(initialValues).length > 0) {
      formFiller.setValues(initialValues);
    }
  }, [selectedPartyId, metadata]);

  const filteredBlocks = filterBlocksByParty(blocks, selectedPartyId);

  const hasRenderablePreviewField = filteredBlocks.some(
    (block) => !!block.field_schema?.field || !!block.phantom_field_schema?.field
  );

  const handleSave = async () => {
    if (!onSave) return;

    // Get final values from form filler
    const finalValues = formFiller.getFinalValues();

    // Validate required fields
    const newErrors = formFiller.validate(fields);

    if (Object.keys(newErrors).length > 0) {
      toast.error("Please fill in all required fields", toastPresets.destructive);
      return;
    }

    try {
      setIsSaving(true);
      await onSave(finalValues);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const mobileFieldsTabs = [
    { id: "template", label: "Fill Template" },
    { id: "preview", label: "Template Preview" },
  ];

  const isMobile = useIsMobile();

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden">
      {isMobile && (
        <MobileStepTabs
          tabs={mobileFieldsTabs}
          activeTab={mobileFieldsTab}
          onTabChange={(tabId) => {
            setMobileFieldsTab(tabId as "template" | "preview");
          }}
        />
      )}

      <div className="flex flex-1 flex-col gap-4 overflow-hidden px-4 md:flex-row">
        {/* Left side - Form */}
        {(!isMobile || mobileFieldsTab === "template") && (
          <div className="relative h-full min-h-0 flex-1 overflow-y-auto bg-white">
            {filteredBlocks.length > 0 ? (
              <FormPreviewRenderer
                formName={formName}
                formLabel={metadata?.label || ""}
                blocks={filteredBlocks}
                values={formFiller.getFinalValues()}
                onChange={(key, value) => formFiller.setValue(key, value)}
                metadata={metadata}
                selectedFieldId={selectedFieldId}
                onFieldClick={setSelectedFieldId}
              />
            ) : (
              <div className="rounded bg-slate-50 p-8 text-center">
                <p className="text-sm text-slate-500">No form fields to fill out.</p>
              </div>
            )}
          </div>
        )}

        {/* Right side - PDF Preview */}
        {(!isMobile || mobileFieldsTab === "preview") && (
          <div className="relative h-full min-h-0 flex-1 overflow-hidden bg-slate-100">
            {documentUrl && hasRenderablePreviewField ? (
              <FormPreviewPdfDisplay
                documentUrl={documentUrl}
                blocks={filteredBlocks}
                values={previewValues}
                onFieldClick={(fieldName) => setSelectedFieldId(fieldName)}
                selectedFieldId={selectedFieldId}
                prefillMode="dummy"
                prefillUser={DEFAULT_PREVIEW_DUMMY_STUDENT_USER}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                  {!documentUrl ? (
                    <>
                      <p className="text-sm text-slate-500">No document to preview</p>
                      <p className="mt-2 text-xs text-slate-400">
                        PDF will appear here when available
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">No form fields in this section</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {onSave && (
        <div className="flex items-center justify-end border-t border-slate-200 bg-white pt-2">
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
            {isSaving ? "Saving..." : "Save Default Values"}
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * Generic form component for capturing and saving default values
 * Shows one party's form with ability to fill in and save values
 */
export const FormDefaultValueCapture = (props: FormDefaultValueCaptureProps) => {
  return (
    <FormFillerContextProvider>
      <FormDefaultValueCaptureContent {...props} />
    </FormFillerContextProvider>
  );
};
