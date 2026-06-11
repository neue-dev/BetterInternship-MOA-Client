import type { IFormBlock, IFormMetadata } from "@betterinternship/core/forms";
import type { BlockGroup, FormViewUnit } from "./types";
import {
  getBlockFieldGroupKey,
  getBlockFieldName,
  getBlockSchema,
  normalizeGroupPartyId,
} from "./helpers";

// The party whose blocks drive the form-view (sort/reorder) surface.
// Matches historical behavior: the first signing party.
export function getActivePartyId(metadata: IFormMetadata | null): string {
  return metadata?.signing_parties?.[0]?._id || "";
}

export function buildBlocksMap(blocks: IFormBlock[]): Record<string, IFormBlock> {
  const map: Record<string, IFormBlock> = {};
  blocks.forEach((block) => {
    map[block._id] = block;
  });
  return map;
}

// Field/header/paragraph "units" for the active party, collapsing radio groups
// and same-field/party/type blocks into a single addressable row.
export function computeFormViewUnits(blocks: IFormBlock[], activePartyId: string): FormViewUnit[] {
  if (!activePartyId) return [];

  const units: FormViewUnit[] = [];
  const fieldUnits = new Map<string, FormViewUnit>();
  const radioGroupUnits = new Map<string, FormViewUnit>();

  blocks.forEach((block) => {
    if ((block.signing_party_id || "") !== activePartyId) return;

    if (block.block_type === "header" || block.block_type === "paragraph") {
      units.push({
        id: block._id,
        kind: block.block_type,
        label:
          (block.text_content || "").trim() ||
          (block.block_type === "header" ? "Header" : "Paragraph"),
        partyId: activePartyId,
        blockIds: [block._id],
        primaryBlockId: block._id,
      });
      return;
    }

    const schema = getBlockSchema(block);
    const fieldName = getBlockFieldName(block);
    if (!fieldName) return;

    const radioGroupId = block.field_schema?.radio_group_id;
    if (radioGroupId) {
      const existing = radioGroupUnits.get(radioGroupId);
      if (existing) {
        existing.blockIds.push(block._id);
        return;
      }
      const unit: FormViewUnit = {
        id: `radio-group-${radioGroupId}`,
        kind: "field",
        label: schema?.label ?? fieldName,
        partyId: activePartyId,
        blockIds: [block._id],
        primaryBlockId: block._id,
      };
      radioGroupUnits.set(radioGroupId, unit);
      units.push(unit);
      return;
    }

    const groupId = getBlockFieldGroupKey(block);
    if (!groupId) return;
    const existing = fieldUnits.get(groupId);
    if (existing) {
      existing.blockIds.push(block._id);
      return;
    }

    const unit: FormViewUnit = {
      id: groupId,
      kind: "field",
      label: schema?.label ?? fieldName,
      partyId: activePartyId,
      blockIds: [block._id],
      primaryBlockId: block._id,
    };
    fieldUnits.set(groupId, unit);
    units.push(unit);
  });

  return units;
}

// Groups every block (all parties) by field+party+type, used for group-level
// selection/editing. Pure: derived directly from blocks.
export function computeBlockGroups(blocks: IFormBlock[]): {
  blockGroups: Record<string, BlockGroup>;
  blockGroupsOrder: string[];
} {
  const blockGroups: Record<string, BlockGroup> = {};
  const blockGroupsOrder: string[] = [];
  const seenGroupIds = new Set<string>();

  blocks.forEach((block) => {
    const blockType = block.block_type;

    if (blockType === "header" || blockType === "paragraph") {
      const groupId = block._id;
      if (!seenGroupIds.has(groupId)) {
        blockGroups[groupId] = {
          id: groupId,
          fieldName: blockType,
          partyId: normalizeGroupPartyId(block.signing_party_id),
          blockIds: [block._id],
        };
        blockGroupsOrder.push(groupId);
        seenGroupIds.add(groupId);
      }
      return;
    }

    const schema = getBlockSchema(block);
    if (!schema) return;

    const fieldName: string = (schema.field || "Unnamed") as string;
    const partyId = normalizeGroupPartyId(block.signing_party_id);
    const groupId = getBlockFieldGroupKey(block) || `${fieldName}-${partyId}-${blockType}`;

    if (!seenGroupIds.has(groupId)) {
      blockGroups[groupId] = {
        id: groupId,
        fieldName,
        partyId,
        blockIds: [block._id],
      };
      blockGroupsOrder.push(groupId);
      seenGroupIds.add(groupId);
    } else {
      blockGroups[groupId].blockIds.push(block._id);
    }
  });

  return { blockGroups, blockGroupsOrder };
}

export function findGroupByBlockId(
  blockGroups: Record<string, BlockGroup>,
  blockGroupsOrder: string[],
  blockId: string
): BlockGroup | null {
  const groupId = blockGroupsOrder.find((id) => blockGroups[id]?.blockIds?.includes(blockId));
  return groupId ? blockGroups[groupId] : null;
}
