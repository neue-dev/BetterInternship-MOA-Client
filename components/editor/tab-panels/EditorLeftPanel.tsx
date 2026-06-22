"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import { BlocksPanel } from "./editor-components/BlocksPanel";
import { RevampedBlockEditor } from "./editor-components/RevampedBlockEditor";

function EditorLeftPanel() {
  const { formMetadata } = useFormEditorMetadata();
  const { selectedBlockId, setSelectedBlockId } = useEditorSelection();

  const selectedBlock = useMemo(
    () =>
      selectedBlockId
        ? (formMetadata?.schema.blocks?.find((b) => b._id === selectedBlockId) ?? null)
        : null,
    [selectedBlockId, formMetadata]
  );
  const fieldLabel = selectedBlock?.field_schema?.label || selectedBlock?.field_schema?.field || "";

  return (
    <div className="flex h-full flex-col overflow-hidden" data-editor-left-panel>
      {selectedBlockId && (
        <div className="flex items-center px-3 py-1.5">
          <Button size="xs" variant="outline" onClick={() => setSelectedBlockId(null)} className="h-8 -mb-2">
            <ArrowLeft />
            Back
          </Button>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          {selectedBlockId ? (
            <motion.div
              key="inspect"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="absolute inset-0 overflow-y-auto"
            >
              <RevampedBlockEditor />
            </motion.div>
          ) : (
            <motion.div
              key="browse"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <BlocksPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export { EditorLeftPanel };
