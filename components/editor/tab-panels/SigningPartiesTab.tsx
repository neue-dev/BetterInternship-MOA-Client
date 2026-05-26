"use client";

import { useFormEditorMetadata } from "@/app/contexts/form-editor-metadata.context";
import { PartiesPanel } from "@/components/docs/form-editor/form-layout/PartiesPanel";

export function SigningPartiesTab() {
  const { formMetadata, updateSigningParties } = useFormEditorMetadata();

  if (!formMetadata) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        No form loaded
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <h3 className="text-lg font-semibold">Recipients</h3>
        <PartiesPanel
          parties={formMetadata.signing_parties || []}
          onPartiesChange={updateSigningParties}
        />
      </div>
    </div>
  );
}
