import { cn } from "@/lib/utils";
import type { MissingFieldSuggestion } from "@/lib/missing-fields/pipeline";

export function MissingFieldSuggestionsOverlay({
  show,
  suggestions,
  pageNumber,
  scale,
  pdfToDisplay,
  selectedSuggestionId,
  onSuggestionSelect,
}: {
  show: boolean;
  suggestions: MissingFieldSuggestion[];
  pageNumber: number;
  scale: number;
  pdfToDisplay: (pdfX: number, pdfY: number) => { displayX: number; displayY: number } | null;
  selectedSuggestionId: string | null;
  onSuggestionSelect: (suggestionId: string) => void;
}) {
  if (!show) return null;

  return (
    <>
      {suggestions
        .filter((suggestion) => suggestion.page === pageNumber)
        .map((suggestion) => {
          const suggestionPosition = pdfToDisplay(suggestion.x, suggestion.y);
          if (!suggestionPosition) return null;
          const isSelected = selectedSuggestionId === suggestion.id;
          return (
            <button
              key={suggestion.id}
              type="button"
              className={cn(
                "absolute z-30 border-2 transition-colors",
                isSelected
                  ? "border-slate-600 bg-slate-300/20"
                  : "border-slate-400/80 bg-slate-300/10 hover:bg-slate-300/15"
              )}
              style={{
                left: `${suggestionPosition.displayX}px`,
                top: `${suggestionPosition.displayY}px`,
                width: `${suggestion.w * scale}px`,
                height: `${suggestion.h * scale}px`,
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(71,85,105,0.12) 0px, rgba(71,85,105,0.12) 6px, transparent 6px, transparent 12px)",
              }}
              title={`Suggested field: ${suggestion.inferredLabel}`}
              onClick={() => onSuggestionSelect(suggestion.id)}
            />
          );
        })}
    </>
  );
}
