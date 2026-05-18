import type { IFormBlock } from "@betterinternship/core/forms";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { detectPdfBlankRegions } from "@/lib/missing-fields/detect";
import { inferSuggestionMetadata } from "@/lib/missing-fields/infer";
import { classifyBlankRegionsAgainstBlocks } from "@/lib/missing-fields/compare";
import { toExistingFieldRects, type MissingFieldSuggestion } from "@/lib/missing-fields/types";

export async function runMissingFieldPipeline({
  pdfDoc,
  blocks,
}: {
  pdfDoc: PDFDocumentProxy;
  blocks: IFormBlock[];
}): Promise<MissingFieldSuggestion[]> {
  const { regions, tokensByPage } = await detectPdfBlankRegions(pdfDoc);
  const inferred = inferSuggestionMetadata(regions, tokensByPage);
  const fieldRects = toExistingFieldRects(blocks);
  return classifyBlankRegionsAgainstBlocks(inferred, fieldRects);
}

export { detectPdfBlankRegions } from "@/lib/missing-fields/detect";
export { getDetectedRegionBaselineY } from "@/lib/missing-fields/detect";
export { classifyBlankRegionsAgainstBlocks } from "@/lib/missing-fields/compare";
export type {
  InferredFieldKind,
  DetectedBlankRegion,
  MissingFieldSuggestion,
} from "@/lib/missing-fields/types";
