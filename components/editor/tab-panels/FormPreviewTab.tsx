"use client";

import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { RecipientTabBar } from "@/components/docs/form-editor/RecipientTabBar";
import { FormPreview } from "@/components/docs/form-editor/form-layout/FormPreview";

function FormPreviewTabContent({ animatePanels = false }: { animatePanels?: boolean }) {
  const { formMetadata } = useFormEditorMetadata();
  const { selectedPartyId, setSelectedPartyId } = useEditorSelection();

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
        <FormPreview
          metadata={formMetadata}
          mode="preview"
          showRecipientTabBar={false}
          animatePanels={animatePanels}
        />
      </div>
    </div>
  );
}

export function FormPreviewTab({ animatePanels = false }: { animatePanels?: boolean }) {
  return <FormPreviewTabContent animatePanels={animatePanels} />;
}
