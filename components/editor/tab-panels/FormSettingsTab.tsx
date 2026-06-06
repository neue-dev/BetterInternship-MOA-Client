"use client";

import { useState } from "react";
import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import { useEditorSelection } from "@/app/contexts/editor-selection.context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMetadataTab } from "@/components/editor/tab-panels/FormMetadataTab";
import { SigningPartiesTab } from "@/components/editor/tab-panels/SigningPartiesTab";
import { SubscribersTab } from "@/components/editor/tab-panels/SubscribersTab";
import FieldRegistryPage from "@/app/docs/ft2mkyEVxHrAJwaphVVSop3TIau0pWDq/fields/page";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { SCHEMA_VERSION } from "@betterinternship/core/forms";

type SettingsSection = "metadata" | "recipients" | "subscribers" | "settings" | "field-registry";

export function FormSettingsTab() {
  const [section, setSection] = useState<SettingsSection>("settings");
  const { setActiveTab } = useEditorSelection();

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <div className="w-56 border-r bg-slate-50/70 p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveTab("editor")}
          className="mb-2 w-full justify-start gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to editor
        </Button>
        <div className="space-y-1">
          <button
            onClick={() => setSection("settings")}
            className={cn(
              "w-full rounded-[0.33em] px-3 py-2 text-left text-sm",
              section === "settings"
                ? "bg-primary/10 text-primary font-medium"
                : "text-slate-700 hover:bg-slate-100"
            )}
          >
            Form Settings
          </button>
          <button
            onClick={() => setSection("metadata")}
            className={cn(
              "w-full rounded-[0.33em] px-3 py-2 text-left text-sm",
              section === "metadata"
                ? "bg-primary/10 text-primary font-medium"
                : "text-slate-700 hover:bg-slate-100"
            )}
          >
            Metadata
          </button>
          <button
            onClick={() => setSection("recipients")}
            className={cn(
              "w-full rounded-[0.33em] px-3 py-2 text-left text-sm",
              section === "recipients"
                ? "bg-primary/10 text-primary font-medium"
                : "text-slate-700 hover:bg-slate-100"
            )}
          >
            Recipients
          </button>
          <button
            onClick={() => setSection("subscribers")}
            className={cn(
              "w-full rounded-[0.33em] px-3 py-2 text-left text-sm",
              section === "subscribers"
                ? "bg-primary/10 text-primary font-medium"
                : "text-slate-700 hover:bg-slate-100"
            )}
          >
            Subscribers
          </button>

          <div className="my-2 border-t border-slate-200" />

          <button
            onClick={() => setSection("field-registry")}
            className={cn(
              "w-full rounded-[0.33em] px-3 py-2 text-left text-sm",
              section === "field-registry"
                ? "bg-primary/10 text-primary font-medium"
                : "text-slate-700 hover:bg-slate-100"
            )}
          >
            Field Registry
          </button>
        </div>
      </div>

      <div
        className={cn(
          "min-h-0 min-w-0 flex-1",
          section === "field-registry" ? "overflow-hidden" : "overflow-auto"
        )}
      >
        {section === "settings" && <FormSettingsContent />}
        {section === "metadata" && <FormMetadataTab />}
        {section === "recipients" && <SigningPartiesTab />}
        {section === "subscribers" && <SubscribersTab />}
        {section === "field-registry" && (
          <div className="h-full min-h-0 p-4">
            <FieldRegistryPage embedded />
          </div>
        )}
      </div>
    </div>
  );
}

function FormSettingsContent() {
  const { formMetadata, updateFormMetadata } = useFormEditorMetadata();

  if (!formMetadata) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        No form loaded
      </div>
    );
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFormMetadata({ name: e.target.value });
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFormMetadata({ label: e.target.value });
  };

  return (
    <div className="h-full w-full overflow-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-5">
          <h3 className="text-lg font-semibold">Metadata Essentials</h3>

          <div>
            <Label htmlFor="form-name" className="text-sm font-medium">
              Form Name
            </Label>
            <Input
              id="form-name"
              value={formMetadata.name}
              onChange={handleNameChange}
              className="mt-2"
              placeholder="e.g., application-form"
            />
            <p className="text-muted-foreground mt-2 text-xs">
              This is the internal identifier for the form
            </p>
          </div>

          <div>
            <Label htmlFor="form-label" className="text-sm font-medium">
              Form Label
            </Label>
            <Input
              id="form-label"
              value={formMetadata.label}
              onChange={handleLabelChange}
              className="mt-2"
              placeholder="e.g., Application Form"
            />
            <p className="text-muted-foreground mt-2 text-xs">This is the display name for users</p>
          </div>
        </div>
      </div>
    </div>
  );
}
