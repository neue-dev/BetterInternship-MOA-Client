"use client";

import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { FormEditorTab } from "@/components/editor/tab-panels/FormEditorTab";
import { FormPreviewTab } from "@/components/editor/tab-panels/FormPreviewTab";
import { FormMetadataTab } from "@/components/editor/tab-panels/FormMetadataTab";
import { SigningPartiesTab } from "@/components/editor/tab-panels/SigningPartiesTab";
import { SubscribersTab } from "@/components/editor/tab-panels/SubscribersTab";
import { FormSettingsTab } from "@/components/editor/tab-panels/FormSettingsTab";
import { AnimatePresence, motion } from "framer-motion";

// Central tab switchboard for the editor route.
export function EditorContent() {
  const { activeTab } = useEditorSelection();

  return (
    <div className="relative h-full w-full overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          className="absolute inset-0"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
          transition={{ duration: 0.36 }}
        >
          {activeTab === "editor" && <FormEditorTab animatePanels />}
          {activeTab === "preview" && <FormPreviewTab animatePanels />}
          {activeTab === "metadata" && <FormMetadataTab />}
          {activeTab === "parties" && <SigningPartiesTab />}
          {activeTab === "subscribers" && <SubscribersTab />}
          {activeTab === "settings" && <FormSettingsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
