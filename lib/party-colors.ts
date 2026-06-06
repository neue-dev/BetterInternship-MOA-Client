/**
 * Utility functions for party color management
 * Used across FieldsPanel, block editor, and PDF rendering
 */

export const PARTY_COLORS = [
  { bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-900", hex: "#fb923c" },
  { bg: "bg-rose-100", border: "border-rose-300", text: "text-rose-900", hex: "#f43f5e" },
  { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-900", hex: "#10b981" },
  { bg: "bg-cyan-100", border: "border-cyan-300", text: "text-cyan-900", hex: "#06b6d4" },
  { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-900", hex: "#f59e0b" },
  { bg: "bg-violet-100", border: "border-violet-300", text: "text-violet-900", hex: "#a78bfa" },
];

/**
 * Get color for a party based on its index in the array
 * @param index - The index of the signing party
 * @returns Color object with Tailwind classes and hex value
 */
export const getPartyColorByIndex = (index: number) => {
  return PARTY_COLORS[index % PARTY_COLORS.length];
};

/**
 * Get color for a signing party using its 1-based order field.
 * order 1 → index 0, order 2 → index 1, etc.
 */
export function getPartyColorByOrder(order: number) {
  return getPartyColorByIndex(Math.max(0, order - 1));
}

/**
 * Returns the human-readable display title for a signing party.
 * The "initiator" party always displays as "Student".
 */
export function getPartyDisplayTitle(
  party: { _id?: string; signatory_title?: string } | null | undefined
): string {
  if (!party) return "";
  return party._id === "initiator" ? "Student" : party.signatory_title || "Party";
}
