import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { FileUp } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PdfViewerStatus({
  pdfDoc,
  isLoadingDoc,
  error,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
}: {
  pdfDoc: PDFDocumentProxy | null;
  isLoadingDoc: boolean;
  error: string | null;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      {isLoadingDoc && (
        <div className="bg-background/70 absolute inset-0 z-10 flex items-center justify-center">
          <Loader>Loading PDFâ€¦</Loader>
        </div>
      )}

      {error && (
        <div className="text-destructive flex h-full items-center justify-center text-sm">
          {error}
        </div>
      )}

      {!error && !pdfDoc && !isLoadingDoc && (
        <div className="flex h-full flex-col items-center justify-center gap-8">
          <div className="text-center">
            <p className="text-base font-medium text-slate-900">Drop your PDF here</p>
            <p className="mt-1 text-sm text-slate-500">or click the button below to browse</p>
          </div>

          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              "flex h-80 w-120 cursor-pointer flex-col items-center justify-center rounded-[0.33em] border-2 border-dashed transition-colors",
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-slate-300 bg-slate-50 hover:border-slate-400"
            )}
          >
            <FileUp className="h-16 w-16 text-slate-400" />
          </div>

          <label className="cursor-pointer">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={onFileChange}
            />
            <Button asChild>
              <span>
                <FileUp className="h-5 w-5" />
                Upload PDF
              </span>
            </Button>
          </label>
        </div>
      )}
    </>
  );
}
