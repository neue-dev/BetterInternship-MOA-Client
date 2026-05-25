import { useState } from "react";
import { IFormBlock } from "@betterinternship/core/forms";

export type ActiveGroupDrag = {
  groupId: string;
  x: number;
  y: number;
} | null;

export function useRadioGroup({
  blocks,
  updateBlocks,
  displayDeltaToPdfDelta,
  onFieldSelect,
  handleBlockCreate,
  handleBlocksCreate,
  handleDuplicateBlock,
}: {
  blocks: IFormBlock[];
  updateBlocks: (blocks: IFormBlock[]) => void;
  displayDeltaToPdfDelta: (
    displayDeltaX: number,
    displayDeltaY: number
  ) => { pdfDeltaX: number; pdfDeltaY: number };
  onFieldSelect: (fieldId: string) => void;
  handleBlockCreate: (block: IFormBlock) => void;
  handleBlocksCreate: (blocks: IFormBlock[]) => void;
  handleDuplicateBlock: (block: IFormBlock) => void;
}) {
  const [activeGroupDrag, setActiveGroupDrag] = useState<ActiveGroupDrag>(null);

  const selectFirstFieldInGroup = (groupId: string) => {
    const firstBlock = blocks
      .filter((b) => b.block_type === "form_field" && b.field_schema?.radio_group_id === groupId)
      .sort((a, b) => (a.field_schema?.x ?? 0) - (b.field_schema?.x ?? 0))[0];
    if (firstBlock) onFieldSelect(firstBlock._id);
  };

  const handleAddRadioOption = (groupId: string) => {
    const groupBlocks = blocks.filter(
      (b) => b.block_type === "form_field" && b.field_schema?.radio_group_id === groupId
    );
    if (!groupBlocks.length) return;

    const rightmost = groupBlocks.reduce((best, b) => {
      const s = b.field_schema!;
      const bestS = best.field_schema!;
      return s.x + s.w > bestS.x + bestS.w ? b : best;
    });
    const schema = rightmost.field_schema!;
    const optionNumber = groupBlocks.length + 1;
    const newFieldKey = `radio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const newBlock: IFormBlock = {
      _id: `block-radio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      block_type: "form_field",
      signing_party_id: rightmost.signing_party_id,
      order: blocks.length,
      field_schema: {
        field: newFieldKey,
        type: "text",
        page: schema.page,
        x: schema.x + schema.w + 4,
        y: schema.y,
        w: schema.w,
        h: schema.h,
        align_h: schema.align_h ?? "center",
        align_v: schema.align_v ?? "middle",
        label: `Option ${optionNumber}`,
        tooltip_label: "",
        shared: schema.shared,
        source: schema.source,
        prefiller: schema.prefiller,
        validator: schema.validator,
        validator_ir: schema.validator_ir,
        size: schema.size,
        wrap: schema.wrap,
        font: schema.font,
        radio_group_id: groupId,
        radio_option_label: `Option ${optionNumber}`,
      },
    };

    handleBlockCreate(newBlock);
  };

  const handleGroupDragMove = (groupId: string, displayDeltaX: number, displayDeltaY: number) => {
    setActiveGroupDrag({ groupId, x: displayDeltaX, y: displayDeltaY });
  };

  const handleGroupDragEnd = (groupId: string, displayDeltaX: number, displayDeltaY: number) => {
    setActiveGroupDrag(null);
    const { pdfDeltaX, pdfDeltaY } = displayDeltaToPdfDelta(displayDeltaX, displayDeltaY);
    const nextBlocks = blocks.map((b) => {
      if (b.block_type !== "form_field") return b;
      if (b.field_schema?.radio_group_id !== groupId) return b;
      const schema = b.field_schema!;
      return {
        ...b,
        field_schema: {
          ...schema,
          x: Math.max(0, schema.x + pdfDeltaX),
          y: Math.max(0, schema.y + pdfDeltaY),
        },
      };
    });
    updateBlocks(nextBlocks);

    selectFirstFieldInGroup(groupId);
  };

  const handleDuplicateField = (fieldId: string) => {
    const block = blocks.find((b) => b._id === fieldId);
    if (!block) return;
    const radioGroupId = block.field_schema?.radio_group_id;
    if (radioGroupId) {
      const groupBlocks = blocks.filter(
        (b) => b.block_type === "form_field" && b.field_schema?.radio_group_id === radioGroupId
      );
      const newGroupId = `rg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const OFFSET = 8;
      const now = Date.now();
      const newBlocks: IFormBlock[] = groupBlocks.map((gb, i) => ({
        ...gb,
        _id: `block_${now}_${i}_${Math.random().toString(36).substr(2, 6)}`,
        field_schema: gb.field_schema
          ? {
              ...gb.field_schema,
              field: `radio_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
              y: (gb.field_schema.y ?? 0) + OFFSET,
              radio_group_id: newGroupId,
            }
          : gb.field_schema,
      }));
      handleBlocksCreate(newBlocks);
    } else {
      handleDuplicateBlock(block);
    }
  };

  return {
    activeGroupDrag,
    selectFirstFieldInGroup,
    handleAddRadioOption,
    handleGroupDragMove,
    handleGroupDragEnd,
    handleDuplicateField,
  };
}
