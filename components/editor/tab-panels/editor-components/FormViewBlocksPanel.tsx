"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import { useFormEditor } from "@/app/contexts/form-editor.context";
import { FormPreviewRenderer } from "@/components/docs/form-editor/form-layout/FormPreviewRenderer";
import { FormMetadata } from "@betterinternship/core/forms";
import { StaticFormRendererContextProvider } from "@/components/docs/forms/form-renderer.ctx";
import { FormFillerContextProvider } from "@/components/docs/forms/form-filler.ctx";

interface FormViewBlocksPanelProps {
  signingParties: any[];
}

export function FormViewBlocksPanel({ signingParties: _signingParties }: FormViewBlocksPanelProps) {
  const { formMetadata } = useFormEditor();
  const {
    selectedPartyId,
    blocks,
    formViewUnits,
    selectedBlockGroup,
    handleSelectFormViewUnit,
  } = useFormEditorTab();

  const activePartyId = selectedPartyId || formMetadata?.signing_parties?.[0]?._id || "";

  // Track selected field ID for the preview renderer context.
  // Seeded from selectedBlockGroup; also updated when the user clicks a field in the renderer.
  const derivedSelectedFieldId = useMemo(() => {
    if (!selectedBlockGroup) return null;
    if (selectedBlockGroup.fieldName === "header" || selectedBlockGroup.fieldName === "paragraph") {
      return null;
    }
    return selectedBlockGroup.fieldName;
  }, [selectedBlockGroup]);

  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(derivedSelectedFieldId);

  useEffect(() => {
    setSelectedPreviewId(derivedSelectedFieldId);
  }, [derivedSelectedFieldId]);

  const hasBlocks = useMemo(
    () =>
      blocks.some((block) => {
        const party = block.signing_party_id || "";
        return party === activePartyId || party === "";
      }),
    [activePartyId, blocks]
  );

  const handleFieldClick = (fieldName: string) => {
    const targetUnit = formViewUnits.find((unit) => {
      if (unit.kind !== "field") return false;
      const unitPrimaryBlock = blocks.find((block) => block._id === unit.primaryBlockId);
      const unitField =
        unitPrimaryBlock?.field_schema?.field || unitPrimaryBlock?.phantom_field_schema?.field;
      return unitField === fieldName;
    });
    if (targetUnit) {
      handleSelectFormViewUnit(targetUnit.id);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-3">
        {!hasBlocks || !formMetadata ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            No blocks for this recipient yet.
          </div>
        ) : (
          <div className="h-full rounded-[0.33em] border bg-white">
            <StaticFormRendererContextProvider
              formName={formMetadata.name}
              formLabel={formMetadata.label}
              formMetadata={formMetadata}
              signingPartyId={activePartyId}
              selectedPreviewId={selectedPreviewId}
              onSelectedPreviewId={setSelectedPreviewId}
            >
              <FormFillerContextProvider>
                <FormPreviewRenderer onFieldClick={handleFieldClick} />
              </FormFillerContextProvider>
            </StaticFormRendererContextProvider>
          </div>
        )}
      </div>
    </div>
  );
}
