"use client";

import { useFormEditor } from "@/app/contexts/form-editor.context";
import { FormEditorTabProvider, useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import { RecipientTabBar } from "@/components/docs/form-editor/RecipientTabBar";
import { FormPreview } from "@/components/docs/form-editor/form-layout/FormPreview";

function FormPreviewTabContent() {
  const { formMetadata } = useFormEditor();
  const { selectedPartyId, setSelectedPartyId } = useFormEditorTab();

  if (!formMetadata) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        No form loaded
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <RecipientTabBar
        parties={formMetadata.signing_parties || []}
        selectedPartyId={selectedPartyId}
        onSelectParty={setSelectedPartyId}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        <FormPreview metadata={formMetadata} mode="preview" showRecipientTabBar={false} />
      </div>
    </div>
  );
}

export function FormPreviewTab() {
  return (
    <FormEditorTabProvider>
      <FormPreviewTabContent />
    </FormEditorTabProvider>
  );
}
