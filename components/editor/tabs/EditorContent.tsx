"use client";

import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { FormEditorTab } from "@/components/editor/tab-panels/FormEditorTab";
import { FormPreviewTab } from "@/components/editor/tab-panels/FormPreviewTab";
import { FormMetadataTab } from "@/components/editor/tab-panels/FormMetadataTab";
import { SigningPartiesTab } from "@/components/editor/tab-panels/SigningPartiesTab";
import { SubscribersTab } from "@/components/editor/tab-panels/SubscribersTab";
import { FormSettingsTab } from "@/components/editor/tab-panels/FormSettingsTab";
import { EditorViewSyncProvider } from "./editor-view-sync.context";
import { cn } from "@/lib/utils";

// One layer of the editor/preview pair. Both layers stay mounted so the PDF
// never re-buffers when toggling; the per-column crossfade/slide is handled
// inside EditorSplitLayout. The inactive layer is click-through.
function PairLayer({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn("absolute inset-0", active ? "z-10" : "pointer-events-none z-0")}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}

// Central tab switchboard for the editor route.
export function EditorContent() {
  const { activeTab } = useEditorSelection();

  // Editor and preview are mounted together so neither remounts (the PDF panels
  // stay parsed/rendered). They share width + scroll + zoom via
  // EditorViewSyncProvider; EditorSplitLayout drives the per-column animation.
  const showPair = activeTab === "editor" || activeTab === "preview";

  return (
    <div className="relative h-full w-full overflow-hidden">
      {showPair && (
        <EditorViewSyncProvider>
          <div className="absolute inset-0">
            <PairLayer active={activeTab === "editor"}>
              <FormEditorTab />
            </PairLayer>
            <PairLayer active={activeTab === "preview"}>
              <FormPreviewTab />
            </PairLayer>
          </div>
        </EditorViewSyncProvider>
      )}

      {activeTab === "metadata" && <FormMetadataTab />}
      {activeTab === "parties" && <SigningPartiesTab />}
      {activeTab === "subscribers" && <SubscribersTab />}
      {activeTab === "settings" && <FormSettingsTab />}
    </div>
  );
}
