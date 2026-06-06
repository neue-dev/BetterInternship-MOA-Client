import { type PointerLocation } from "./use-pdf-coordinate-transform";

export function PdfPageHeader({
  pageNumber,
  hover,
}: {
  pageNumber: number;
  hover: PointerLocation | null;
}) {
  return (
    <div className="text-muted-foreground flex items-center justify-between border-b px-3 py-2 text-xs">
      <span>Page {pageNumber}</span>
      {hover ? (
        <span className="text-[11px]">
          x={hover.pdfX.toFixed(2)}, y={hover.pdfY.toFixed(2)}
        </span>
      ) : null}
    </div>
  );
}
