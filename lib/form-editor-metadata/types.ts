import type { IFormBlock } from "@betterinternship/core/forms";

export interface BlockGroup {
  id: string;
  fieldName: string;
  partyId: string;
  blockIds: string[];
}

export interface FormViewUnit {
  id: string;
  kind: "field" | "header" | "paragraph";
  label: string;
  partyId: string;
  blockIds: string[];
  primaryBlockId: string;
}

export type ParentPatch = Record<string, any>;

export type { IFormBlock };
