"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Save, Settings, ArrowLeft, Menu, Undo2, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatWhen } from "@/lib/format";
import { SaveConfirmDialog } from "@/components/editor/SaveConfirmDialog";

/**
 * Header toolbar for editor page:
 * - global navigation
 * - undo / redo
 * - quick mode switches (settings/preview)
 * - save action (opens confirmation dialog)
 */
export function EditorToolbar() {
  const { formMetadata, formDocument, formVersion, isSaving, canUndo, canRedo, undo, redo } =
    useFormEditorMetadata();
  const { activeTab, setActiveTab } = useEditorSelection();
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  return (
    <div className="bg-card flex items-center justify-between border-b px-6 py-3">
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8" title="Navigation">
              <Menu className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/dashboard">My Signed Forms</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/forms">Form Automation</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/">Home</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>

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
