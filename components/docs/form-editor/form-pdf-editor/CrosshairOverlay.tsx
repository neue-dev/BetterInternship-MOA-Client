import { type PointerLocation } from "./use-pdf-coordinate-transform";

export function CrosshairOverlay({ hover }: { hover: PointerLocation | null }) {
  if (!hover) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="bg-primary/50 absolute h-full w-px" style={{ left: `${hover.displayX}px` }} />
      <div
        className="border-primary/50 absolute w-full border-t"
        style={{ top: `${hover.displayY}px` }}
      />
    </div>
  );
}
