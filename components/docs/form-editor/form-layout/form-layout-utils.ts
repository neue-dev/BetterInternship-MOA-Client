import type { IFormBlock } from "@betterinternship/core/forms";

/**
 * Returns blocks that belong to a specific signing party, plus blocks with no
 * party assignment (shared/global blocks visible to all parties).
 */
export function filterBlocksByParty(blocks: IFormBlock[], partyId: string): IFormBlock[] {
  return blocks.filter((b) => b.signing_party_id === partyId || !b.signing_party_id);
}
