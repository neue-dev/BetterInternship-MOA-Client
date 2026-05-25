import { ZoomIn, ZoomOut, FileUp, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PdfViewerToolbar({
  visiblePage,
  pageCount,
  scale,
  canUseTools,
  showMissingFieldSuggestions,
  isMissingFieldScanRunning,
  isBaselineAlignmentRunning,
  showBaselineGuides,
  onZoom,
  onToggleMissingFields,
  onAlignBaselines,
  onToggleBaselineGuides,
  onFileChange,
}: {
  visiblePage: number;
  pageCount: number;
  scale: number;
  canUseTools: boolean;
  showMissingFieldSuggestions: boolean;
  isMissingFieldScanRunning: boolean;
  isBaselineAlignmentRunning: boolean;
  showBaselineGuides: boolean;
  onZoom: (direction: "in" | "out") => void;
  onToggleMissingFields: () => void;
  onAlignBaselines: () => void;
  onToggleBaselineGuides: (checked: boolean) => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="relative flex-shrink-0 border-b border-slate-300 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                title="Open PDF tools"
                aria-label="Open PDF tools"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel>PDF Tools</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onToggleMissingFields}
                disabled={!canUseTools || isMissingFieldScanRunning}
              >
                {isMissingFieldScanRunning
                  ? "Scanning..."
                  : showMissingFieldSuggestions
                    ? "Clear Missing Fields"
                    : "Find Missing Fields"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onAlignBaselines}
                disabled={!canUseTools || isMissingFieldScanRunning || isBaselineAlignmentRunning}
              >
                {isBaselineAlignmentRunning ? "Aligning..." : "Align Fields to Baselines"}
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem
                checked={showBaselineGuides}
                onCheckedChange={(checked) => onToggleBaselineGuides(Boolean(checked))}
              >
                Show baselines
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

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
