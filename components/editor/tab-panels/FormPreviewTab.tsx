"use client";

import { useFormEditor } from "@/app/contexts/form-editor.context";
import { FormEditorTabProvider } from "@/app/contexts/form-editor-tab.context";
import { FormPreview } from "@/components/docs/form-editor/form-layout/FormPreview";

export function FormPreviewTab() {
  const { formMetadata } = useFormEditor();

  if (!formMetadata) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        No form loaded
      </div>
    );
  }

  return (
    <FormEditorTabProvider>
      <div className="flex h-full w-full flex-col overflow-auto">
        <FormPreview metadata={formMetadata} mode="preview" />
      </div>
    </FormEditorTabProvider>
  );
}
