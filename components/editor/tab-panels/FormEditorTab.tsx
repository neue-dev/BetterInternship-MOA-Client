"use client";

import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { useEditorViewSync } from "@/components/editor/tabs/editor-view-sync.context";
import { FormEditorPdfViewer } from "@/components/docs/form-editor/form-pdf-editor/FormEditorPdfViewer";
import { RecipientTabBar } from "@/components/docs/form-editor/RecipientTabBar";
import { EditorSplitLayout } from "@/components/editor/tabs/EditorSplitLayout";
import { EditorLeftPanel } from "./EditorLeftPanel";

/**
 * Main builder surface (left palette + right PDF). Shares its column geometry
 * with the preview via EditorSplitLayout so the two crossfade in place.
 */
function FormEditorTabContent() {
  const { formMetadata } = useFormEditorMetadata();
  const { selectedPartyId, setSelectedPartyId } = useEditorSelection();
  const { registerEditorScroller } = useEditorViewSync();

  if (!formMetadata) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        No form loaded
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full w-full flex-col overflow-hidden">
      <RecipientTabBar
        parties={formMetadata.signing_parties || []}
        selectedPartyId={selectedPartyId}
        onSelectParty={setSelectedPartyId}
      />
      <EditorSplitLayout
        side="editor"
        left={<EditorLeftPanel />}
        right={
          <FormEditorPdfViewer showRecipientTabBar={false} registerScrollContainer={registerEditorScroller} />
        }
      />
    </div>
  );
}

export function FormEditorTab() {
  return <FormEditorTabContent />;
}
