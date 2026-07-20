import type { IFormBlock } from "@betterinternship/core/forms";
import type { RepeatedPdfField } from "@/lib/repeated-pdf-fields";

type Props = {
  blocks: IFormBlock[];
  pdfToDisplay: (pdfX: number, pdfY: number) => { displayX: number; displayY: number } | null;
};

export function RepeatFieldOverlay({ blocks, pdfToDisplay }: Props) {
  return (
    <>
      {blocks.map((block) => {
        const schema = block.field_schema;
        const repeat = (schema as (typeof schema & { repeat?: RepeatedPdfField }) | undefined)
          ?.repeat;
        if (!schema || !repeat) return null;

        const count = Math.max(1, Math.floor(repeat.count || 0));
        const lastIndex = count - 1;
        const lastX = schema.x + (repeat.offset_x ?? 0) * lastIndex;
        const lastY = schema.y + (repeat.offset_y ?? 0) * lastIndex;
        const pad = 6;
        const topLeft = pdfToDisplay(
          Math.min(schema.x, lastX) - pad,
          Math.min(schema.y, lastY) - pad
        );
        const bottomRight = pdfToDisplay(
          Math.max(schema.x + schema.w, lastX + schema.w) + pad,
          Math.max(schema.y + schema.h, lastY + schema.h) + pad
        );
        if (!topLeft || !bottomRight) return null;

        return (
          <div
            key={block._id}
            className="pointer-events-none absolute z-10 rounded border-2 border-dashed border-indigo-400/50"
            style={{
              left: `${topLeft.displayX}px`,
              top: `${topLeft.displayY}px`,
              width: `${bottomRight.displayX - topLeft.displayX}px`,
              height: `${bottomRight.displayY - topLeft.displayY}px`,
            }}
          />
        );
      })}
    </>
  );
}
