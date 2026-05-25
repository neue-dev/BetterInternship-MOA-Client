import { IFormBlock } from "@betterinternship/core/forms";

export function useFieldInteractions({
  blocks,
  onBlockUpdate,
  updateBlocks,
  displayDeltaToPdfDelta,
  onVisible,
  onFieldSelect,
}: {
  blocks: IFormBlock[];
  onBlockUpdate: (block: IFormBlock) => void;
  updateBlocks: (blocks: IFormBlock[]) => void;
  displayDeltaToPdfDelta: (
    displayDeltaX: number,
    displayDeltaY: number
  ) => { pdfDeltaX: number; pdfDeltaY: number };
  onVisible: (page: number) => void;
  onFieldSelect: (fieldId: string) => void;
}) {
  const handleFieldDrag = (fieldId: string, displayDeltaX: number, displayDeltaY: number) => {
    const { pdfDeltaX, pdfDeltaY } = displayDeltaToPdfDelta(displayDeltaX, displayDeltaY);
    const block = blocks.find((b) => b._id === fieldId);
    if (!block || !block.field_schema) {
      console.warn("handleFieldDrag: block or field_schema not found", {
        fieldId,
        availableFields: blocks.map((b) => ({ id: b._id, label: b.field_schema?.label })),
      });
      return;
    }

    const newX = Math.max(0, block.field_schema.x + pdfDeltaX);
    const newY = Math.max(0, block.field_schema.y + pdfDeltaY);

    const updatedBlock: IFormBlock = {
      ...block,
      field_schema: {
        ...block.field_schema,
        x: newX,
        y: newY,
      },
    };
    onBlockUpdate(updatedBlock);
  };

  const handleFieldResize = (
    fieldId: string,
    handle: "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se",
    displayDeltaX: number,
    displayDeltaY: number
  ) => {
    const { pdfDeltaX, pdfDeltaY } = displayDeltaToPdfDelta(displayDeltaX, displayDeltaY);
    const block = blocks.find((b) => b._id === fieldId);
    if (!block || !block.field_schema) return;

    const minSize = 10;
    const fieldSchema = block.field_schema;

    let newX = fieldSchema.x;
    let newY = fieldSchema.y;
    let newW = fieldSchema.w;
    let newH = fieldSchema.h;

    if (handle === "n") {
      newY = Math.max(0, fieldSchema.y + pdfDeltaY);
      newH = Math.max(minSize, fieldSchema.h - pdfDeltaY);
    } else if (handle === "e") {
      newW = Math.max(minSize, fieldSchema.w + pdfDeltaX);
    } else if (handle === "s") {
      newH = Math.max(minSize, fieldSchema.h + pdfDeltaY);
    } else if (handle === "w") {
      newX = Math.max(0, fieldSchema.x + pdfDeltaX);
      newW = Math.max(minSize, fieldSchema.w - pdfDeltaX);
    } else if (handle === "nw") {
      newX = Math.max(0, fieldSchema.x + pdfDeltaX);
      newY = Math.max(0, fieldSchema.y + pdfDeltaY);
      newW = Math.max(minSize, fieldSchema.w - pdfDeltaX);
      newH = Math.max(minSize, fieldSchema.h - pdfDeltaY);
    } else if (handle === "ne") {
      newY = Math.max(0, fieldSchema.y + pdfDeltaY);
      newW = Math.max(minSize, fieldSchema.w + pdfDeltaX);
      newH = Math.max(minSize, fieldSchema.h - pdfDeltaY);
    } else if (handle === "sw") {
      newX = Math.max(0, fieldSchema.x + pdfDeltaX);
      newW = Math.max(minSize, fieldSchema.w - pdfDeltaX);
      newH = Math.max(minSize, fieldSchema.h + pdfDeltaY);
    } else if (handle === "se") {
      newW = Math.max(minSize, fieldSchema.w + pdfDeltaX);
      newH = Math.max(minSize, fieldSchema.h + pdfDeltaY);
    }

    const updatedBlock: IFormBlock = {
      ...block,
      field_schema: {
        ...fieldSchema,
        x: newX,
        y: newY,
        w: newW,
        h: newH,
      },
    };
    onBlockUpdate(updatedBlock);
  };

  const handleFieldRecipientChange = (fieldId: string, partyId: string) => {
    const block = blocks.find((b) => b._id === fieldId);
    if (!block) return;
    const radioGroupId = block.field_schema?.radio_group_id as string | undefined;
    if (radioGroupId) {
      const updatedBlocks = blocks.map((b) => {
        if (b.block_type !== "form_field" || b.field_schema?.radio_group_id !== radioGroupId)
          return b;
        return { ...b, signing_party_id: partyId };
      });
      updateBlocks(updatedBlocks);
    } else {
      onBlockUpdate({ ...block, signing_party_id: partyId });
    }
  };

  const findSameFieldIds = (fieldId: string): string[] => {
    const target = blocks.find((b) => b._id === fieldId);
    const fieldName = target?.field_schema?.field;
    if (!fieldName) return [fieldId];
    return blocks
      .filter((b) => b.block_type === "form_field" && b.field_schema?.field === fieldName)
      .sort((a, b) => {
        const aPage = a.field_schema?.page || 0;
        const bPage = b.field_schema?.page || 0;
        if (aPage !== bPage) return aPage - bPage;
        return (a.order || 0) - (b.order || 0);
      })
      .map((b) => b._id);
  };

  const selectSameFieldAtIndex = (ids: string[], index: number) => {
    const targetId = ids[index];
    if (!targetId) return;
    const targetBlock = blocks.find((b) => b._id === targetId);
    const targetPage = targetBlock?.field_schema?.page;
    if (typeof targetPage === "number" && targetPage > 0) {
      onVisible(targetPage);
    }
    onFieldSelect(targetId);
  };

  const handleSelectNextSameField = (fieldId: string) => {
    const ids = findSameFieldIds(fieldId);
    if (ids.length <= 1) return;
    const idx = ids.indexOf(fieldId);
    const nextIndex = (idx + 1 + ids.length) % ids.length;
    selectSameFieldAtIndex(ids, nextIndex);
  };

  const handleSelectPrevSameField = (fieldId: string) => {
    const ids = findSameFieldIds(fieldId);
    if (ids.length <= 1) return;
    const idx = ids.indexOf(fieldId);
    const prevIndex = (idx - 1 + ids.length) % ids.length;
    selectSameFieldAtIndex(ids, prevIndex);
  };

  return {
    handleFieldDrag,
    handleFieldResize,
    handleFieldRecipientChange,
    findSameFieldIds,
    handleSelectNextSameField,
    handleSelectPrevSameField,
  };
}
