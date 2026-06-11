export const DEFAULT_PAGE_WIDTH = 560;
export const DEFAULT_PAGE_HEIGHT = 760;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const createUniqueFieldKey = (base: string) =>
  `${base}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const normalizeVerticalAlign = (value: unknown): "top" | "middle" | "bottom" => {
  if (value === "middle" || value === "bottom" || value === "top") return value;
  return "top";
};
