"use client";

import { useFormEditor } from "@/app/contexts/form-editor.context";
import { FormEditorTabProvider, useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import { PdfViewerProvider } from "@/app/contexts/pdf-viewer.context";
import { PdfViewer } from "@/components/docs/form-editor/form-pdf-editor/PdfViewer";
import { RecipientTabBar } from "@/components/docs/form-editor/RecipientTabBar";
import { BlocksPanel } from "./editor-components/BlocksPanel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Main builder surface (left palette + center PDF + right block editor).
 * Wrapped with tab/pdf providers so child panels share selection and placement state.
 */
function FormEditorTabContent() {
  const { formMetadata } = useFormEditor();
  const { selectedPartyId, setSelectedPartyId } = useFormEditorTab();
  const isMobile = useIsMobile();

  if (!formMetadata) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        No form loaded
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="bg-background flex h-full w-full flex-col overflow-hidden">
        <RecipientTabBar
          parties={formMetadata.signing_parties || []}
          selectedPartyId={selectedPartyId}
          onSelectParty={setSelectedPartyId}
        />
        <div className="flex min-h-0 flex-1">
          <div className="bg-card flex flex-shrink-0 basis-72 flex-col overflow-hidden border-r lg:basis-[320px] xl:basis-[360px]">
            <BlocksPanel />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden border-r">
            <PdfViewer showRecipientTabBar={false} />
          </div>
        </div>
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
      <ResizablePanelGroup
        direction="horizontal"
        autoSaveId="form-editor:pdf-layout"
        className="min-h-0 flex-1"
      >
        <ResizablePanel
          defaultSize={25}
          minSize={18}
          maxSize={40}
          className="bg-card overflow-hidden"
        >
          <BlocksPanel />
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize={75} minSize={40} className="min-w-0 overflow-hidden">
          <PdfViewer showRecipientTabBar={false} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export function FormEditorTab() {
  const { documentFile, setDocumentFile, lastLoadedFileName, setLastLoadedFileName } =
    useFormEditor();

  return (
    <PdfViewerProvider
      documentFile={documentFile}
      setDocumentFile={setDocumentFile}
      lastLoadedFileName={lastLoadedFileName}
      setLastLoadedFileName={setLastLoadedFileName}
    >
      <FormEditorTabProvider>
        <FormEditorTabContent />
      </FormEditorTabProvider>
    </PdfViewerProvider>
  );
}
