import { ZoomIn, ZoomOut, FileUp } from "lucide-react";

export function PdfViewerToolbar({
  visiblePage,
  pageCount,
  scale,
  children,
  onZoom,
  onFileChange,
}: {
  visiblePage: number;
  pageCount: number;
  scale: number;
  children?: React.ReactNode;
  onZoom: (direction: "in" | "out") => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="relative flex h-12 flex-shrink-0 items-center border-b border-slate-300 bg-white px-3">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-1">{children}</div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-700">
              {visiblePage}/{pageCount || 1}
            </span>
            <div className="ml-1 inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => onZoom("out")}
                disabled={scale <= 0.5}
                className="rounded p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                title="Zoom out"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onZoom("in")}
                disabled={scale >= 3}
                className="rounded p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                title="Zoom in"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
            <span className="w-10 text-center text-[11px] font-medium text-slate-700">
              {Math.round(scale * 100)}%
            </span>
          </div>

          <label
            className="flex cursor-pointer items-center rounded p-1.5 text-sm transition-colors hover:bg-slate-100"
            title="Upload PDF"
            aria-label="Upload PDF"
          >
            <FileUp className="h-4 w-4" />
            <input type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
          </label>
        </div>
      </div>
    </div>
  );
}
