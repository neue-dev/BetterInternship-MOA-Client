"use client";

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
import { Save, Eye, Settings, ArrowLeft, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatWhen } from "@/lib/format";

/**
 * Header toolbar for editor page:
 * - global navigation
 * - quick mode switches (settings/preview)
 * - save action bound to FormEditor context
 */
export function EditorToolbar() {
  const { formMetadata, formDocument, formVersion, isSaving, saveForm } = useFormEditorMetadata();
  const { activeTab, setActiveTab } = useEditorSelection();
  const isPreviewMode = activeTab === "preview";

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
          variant="outline"
          size="sm"
          onClick={() => setActiveTab(isPreviewMode ? "editor" : "preview")}
          className={cn("gap-2", activeTab === "preview" && "border-primary text-primary")}
        >
          {isPreviewMode ? <ArrowLeft className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {isPreviewMode ? "Back" : "Preview"}
        </Button>

        <Button onClick={() => void saveForm()} disabled={isSaving} size="sm" className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save Form"}
        </Button>
      </div>
    </div>
  );
}
