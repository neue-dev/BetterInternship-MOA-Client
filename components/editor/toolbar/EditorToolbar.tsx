"use client";

import { useState } from "react";
import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { Button } from "@/components/ui/button";
import { Save, Settings, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatWhen } from "@/lib/format";
import { SaveConfirmDialog } from "@/components/editor/SaveConfirmDialog";

/**
 * Header toolbar for editor page:
 * - quick mode switches (settings/preview)
 * - save action (opens confirmation dialog)
 */
export function EditorToolbar() {
  const { formMetadata, formDocument, formVersion, isSaving } =
    useFormEditorMetadata();
  const { activeTab, setActiveTab } = useEditorSelection();
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  return (
    <div className="bg-card flex items-center justify-between border-b px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-sm font-semibold">{formMetadata?.label || "New Form"}</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-xs">
              v{formVersion ?? formDocument?.version ?? 0}
            </p>

            {formDocument?.time_generated && (
              <>
                <span className="text-muted-foreground/40 text-xs">|</span>
                <p className="text-muted-foreground text-xs">
                  {formatWhen(formDocument.time_generated, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {activeTab === "settings" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab("editor")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab("settings")}
            className={cn(activeTab === "settings" && "border-primary text-primary")}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}

        <Button
          onClick={() => setShowSaveDialog(true)}
          disabled={isSaving}
          size="sm"
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving…" : "Save Form"}
        </Button>

        <SaveConfirmDialog open={showSaveDialog} onOpenChange={setShowSaveDialog} />
      </div>
    </div>
  );
}
