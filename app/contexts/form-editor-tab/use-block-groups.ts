import { useCallback, useEffect, useMemo, useState } from "react";
import type { IFormBlock, IFormMetadata } from "@betterinternship/core/forms";
import type { BlockGroup, FormViewUnit } from "./types";

export function useBlockGroups({
  formMetadata,
  blocks,
}: {
  formMetadata: IFormMetadata | null;
  blocks: IFormBlock[];
}) {
  const [blockGroupsOrder, setBlockGroupsOrder] = useState<string[]>([]);
  const [blockGroups, setBlockGroups] = useState<Record<string, BlockGroup>>({});

  const activePartyId = useMemo(() => {
    return formMetadata?.signing_parties?.[0]?._id || "";
  }, [formMetadata?.signing_parties]);

  const formViewUnits = useMemo<FormViewUnit[]>(() => {
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

      const schema = block.field_schema || block.phantom_field_schema;
      const fieldName = schema?.field;
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

      const groupId = `${fieldName}-${activePartyId}-${block.block_type}`;
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
  }, [activePartyId, blocks]);

  useEffect(() => {
    const newBlockGroups: Record<string, BlockGroup> = {};
    const newOrder: string[] = [];
    const seenGroupIds = new Set<string>();

    blocks.forEach((block) => {
      const blockType = block.block_type;

      if (blockType === "header" || blockType === "paragraph") {
        const groupId = block._id;
        if (!seenGroupIds.has(groupId)) {
          newBlockGroups[groupId] = {
            id: groupId,
            fieldName: blockType,
            partyId: block.signing_party_id || "unknown",
            blockIds: [block._id],
          };
          newOrder.push(groupId);
          seenGroupIds.add(groupId);
        }
        return;
      }

      /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
      let schema: any = block.field_schema;
      if (!schema && (blockType === "phantom_field" || blockType === "form_phantom_field")) {
        schema = block.phantom_field_schema;
      }
      /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
      if (!schema) return;

      const fieldName: string = (schema.field || "Unnamed") as string;
      const partyId = block.signing_party_id || "unknown";
      const groupId = `${fieldName}-${partyId}-${blockType}`;

      if (!seenGroupIds.has(groupId)) {
        newBlockGroups[groupId] = {
          id: groupId,
          fieldName,
          partyId,
          blockIds: [block._id],
        };
        newOrder.push(groupId);
        seenGroupIds.add(groupId);
      } else {
        newBlockGroups[groupId].blockIds.push(block._id);
      }
    });

    setBlockGroupsOrder(newOrder);
    setBlockGroups(newBlockGroups);
  }, [blocks]);

  const findGroupByBlockId = useCallback(
    (blockId: string): BlockGroup | null => {
      const groupId = blockGroupsOrder.find((id) => blockGroups[id]?.blockIds?.includes(blockId));
      return groupId ? blockGroups[groupId] : null;
    },
    [blockGroups, blockGroupsOrder]
  );

  return {
    blockGroupsOrder,
    blockGroups,
    setBlockGroups,
    setBlockGroupsOrder,
    activePartyId,
    formViewUnits,
    findGroupByBlockId,
  };
}
