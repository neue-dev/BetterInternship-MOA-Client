"use client";

import { useFormEditor } from "@/app/contexts/form-editor.context";
import { FormEditorTabProvider, useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import { PdfViewerProvider } from "@/app/contexts/pdf-viewer.context";
import { PdfViewer } from "@/components/docs/form-editor/form-pdf-editor/PdfViewer";
import { RecipientTabBar } from "@/components/docs/form-editor/RecipientTabBar";
import { BlocksPanel } from "./editor-components/BlocksPanel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion } from "framer-motion";

type AnimatedPanelProps = {
  animatePanels?: boolean;
  children: React.ReactNode;
  className?: string;
  order: number;
};

const PANEL_TRANSITION_SECONDS = 0.2;
const PANEL_STAGGER_SECONDS = 0.07;

function AnimatedPanel({ animatePanels = false, children, className, order }: AnimatedPanelProps) {
  if (!animatePanels) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: {
          delay: order * PANEL_STAGGER_SECONDS,
          duration: PANEL_TRANSITION_SECONDS,
          ease: "easeOut",
        },
      }}
      exit={{
        opacity: 0,
        y: 18,
        transition: {
          delay: order * PANEL_STAGGER_SECONDS,
          duration: PANEL_TRANSITION_SECONDS,
          ease: "easeIn",
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Main builder surface (left palette + center PDF + right block editor).
 * Wrapped with tab/pdf providers so child panels share selection and placement state.
 */
function FormEditorTabContent({ animatePanels = false }: { animatePanels?: boolean }) {
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
          <AnimatedPanel
            animatePanels={animatePanels}
            className="bg-card flex flex-shrink-0 basis-72 flex-col overflow-hidden border-r lg:basis-[320px] xl:basis-[360px]"
            order={0}
          >
            <BlocksPanel />
          </AnimatedPanel>
          <AnimatedPanel
            animatePanels={animatePanels}
            className="min-w-0 flex-1 overflow-hidden border-r"
            order={1}
          >
            <PdfViewer showRecipientTabBar={false} />
          </AnimatedPanel>
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
          <AnimatedPanel animatePanels={animatePanels} className="h-full border-r" order={0}>
            <BlocksPanel />
          </AnimatedPanel>
        </ResizablePanel>

        <ResizableHandle className="bg-transparent" />

        <ResizablePanel defaultSize={75} minSize={40} className="min-w-0 overflow-hidden">
          <AnimatedPanel animatePanels={animatePanels} className="h-full" order={1}>
            <PdfViewer showRecipientTabBar={false} />
          </AnimatedPanel>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export function FormEditorTab({ animatePanels = false }: { animatePanels?: boolean }) {
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
        <FormEditorTabContent animatePanels={animatePanels} />
      </FormEditorTabProvider>
    </PdfViewerProvider>
  );
}
