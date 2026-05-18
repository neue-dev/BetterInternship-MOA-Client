import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/types/src/display/api";
import type {
  DetectionResult,
  DetectedBlankRegion,
  PdfTextToken,
} from "@/lib/missing-fields/types";

const MIN_LINE_LENGTH = 48;
const DEFAULT_LINE_FIELD_HEIGHT = 12;
const RASTER_MAX_RENDER_WIDTH = 1400;
const RASTER_MAX_SCALE = 2;
const RASTER_DARK_LUMA = 96;
const RASTER_MIN_DARK_RATIO = 0.45;
const RASTER_MAX_RUN_GAP = 3;
const RASTER_MAX_LINE_ROW_GAP = 3;
export const DEFAULT_TEXT_BASELINE_FROM_TOP = 9.8;

export const getDetectedRegionBaselineY = (region: DetectedBlankRegion) => {
  if (region.patternType === "horizontal-line" || region.patternType === "underscore") {
    return region.y + DEFAULT_TEXT_BASELINE_FROM_TOP;
  }

  return region.y + region.h / 2;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const stableRegionId = (region: Omit<DetectedBlankRegion, "id">) => {
  const rx = Math.round(region.x);
  const ry = Math.round(region.y);
  const rw = Math.round(region.w);
  const rh = Math.round(region.h);
  return `p${region.page}:${region.patternType}:${rx}:${ry}:${rw}:${rh}`;
};

const normalizeCandidate = (
  candidate: Omit<DetectedBlankRegion, "id">,
  pageWidth: number,
  pageHeight: number
): DetectedBlankRegion | null => {
  const x = clamp(candidate.x, 0, Math.max(0, pageWidth - 1));
  const y = clamp(candidate.y, 0, Math.max(0, pageHeight - 1));
  const w = clamp(candidate.w, 0, Math.max(0, pageWidth - x));
  const h = clamp(candidate.h, 0, Math.max(0, pageHeight - y));

  if (w < 8 || h < 6) return null;

  return {
    ...candidate,
    id: stableRegionId({ ...candidate, x, y, w, h }),
    x,
    y,
    w,
    h,
  };
};

const rectIou = (a: DetectedBlankRegion, b: DetectedBlankRegion) => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (intersection <= 0) return 0;

  const areaA = a.w * a.h;
  const areaB = b.w * b.h;
  return intersection / Math.max(1, areaA + areaB - intersection);
};

const rectOverlapOverSmaller = (a: DetectedBlankRegion, b: DetectedBlankRegion) => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (intersection <= 0) return 0;
  const smallerArea = Math.max(1, Math.min(a.w * a.h, b.w * b.h));
  return intersection / smallerArea;
};

const horizontalOverlapRatio = (a: DetectedBlankRegion, b: DetectedBlankRegion) => {
  const x1 = Math.max(a.x, b.x);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const overlap = Math.max(0, x2 - x1);
  const minWidth = Math.max(1, Math.min(a.w, b.w));
  return overlap / minWidth;
};

const dedupeRegions = (regions: DetectedBlankRegion[]) => {
  const sorted = [...regions].sort((a, b) => b.confidence - a.confidence);
  const kept: DetectedBlankRegion[] = [];

  for (const region of sorted) {
    const duplicate = kept.some((existing) => {
      if (existing.page !== region.page) return false;

      // Strong geometric overlap (handles same-region multi-pass detections).
      if (rectIou(existing, region) >= 0.58) return true;
      if (rectOverlapOverSmaller(existing, region) >= 0.72) return true;

      // Merge stacked near-identical horizontal suggestions (common in table lines).
      const yCenterDistance = Math.abs(existing.y + existing.h / 2 - (region.y + region.h / 2));
      const widthRatio = Math.min(existing.w, region.w) / Math.max(existing.w, region.w);
      const similarBand = yCenterDistance <= 10 && widthRatio >= 0.72;
      if (!similarBand) return false;
      return horizontalOverlapRatio(existing, region) >= 0.8;
    });
    if (!duplicate) kept.push(region);
  }

  return kept;
};

const extractTextTokensForPage = async (
  pdfPage: PDFPageProxy,
  page: number,
  pageWidth: number,
  pageHeight: number
): Promise<PdfTextToken[]> => {
  const text = await pdfPage.getTextContent();
  const tokens: PdfTextToken[] = [];

  const isTextItemLike = (
    candidate: unknown
  ): candidate is { str: string; transform: number[]; width: number; height: number } => {
    if (!candidate || typeof candidate !== "object") return false;
    const item = candidate as Record<string, unknown>;
    return (
      typeof item.str === "string" &&
      Array.isArray(item.transform) &&
      typeof item.width === "number" &&
      typeof item.height === "number"
    );
  };

  for (const item of text.items || []) {
    if (!isTextItemLike(item)) continue;
    const raw = item.str.replace(/\s+/g, " ").trim();
    if (!raw) continue;

    const transform = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
    const tx = Number(transform[4]) || 0;
    const ty = Number(transform[5]) || 0;
    const width = Math.max(4, Number(item.width) || 0);
    const height = Math.max(8, Math.abs(Number(item.height) || Number(transform[3]) || 0));

    // Most docs expose bottom-left oriented y for content operations. Convert to top-left space.
    const topY = clamp(pageHeight - ty - height, 0, Math.max(0, pageHeight - height));

    const x = clamp(tx, 0, Math.max(0, pageWidth - width));
    const y = topY;
    const w = Math.min(width, Math.max(4, pageWidth - x));
    const h = Math.min(height, Math.max(8, pageHeight - y));

    tokens.push({
      page,
      text: raw,
      x,
      y,
      w,
      h,
      cx: x + w / 2,
      cy: y + h / 2,
    });
  }

  return tokens;
};

type RasterLineRun = {
  x1: number;
  x2: number;
  y: number;
  darkCount: number;
};

const isDarkPixel = (data: Uint8ClampedArray, index: number) => {
  const alpha = data[index + 3];
  if (alpha < 32) return false;

  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luma <= RASTER_DARK_LUMA;
};

const findRasterLineRunsForRow = (
  data: Uint8ClampedArray,
  width: number,
  row: number,
  minRunWidthPx: number
): RasterLineRun[] => {
  const runs: RasterLineRun[] = [];
  const rowOffset = row * width * 4;
  let runStart: number | null = null;
  let runEnd = 0;
  let darkCount = 0;
  let gap = 0;

  const flushRun = () => {
    if (runStart === null) return;

    const span = runEnd - runStart + 1;
    const darkRatio = darkCount / Math.max(1, span);
    if (span >= minRunWidthPx && darkRatio >= RASTER_MIN_DARK_RATIO) {
      runs.push({
        x1: runStart,
        x2: runEnd,
        y: row,
        darkCount,
      });
    }

    runStart = null;
    runEnd = 0;
    darkCount = 0;
    gap = 0;
  };

  for (let x = 0; x < width; x += 1) {
    const dark = isDarkPixel(data, rowOffset + x * 4);
    if (dark) {
      if (runStart === null) runStart = x;
      runEnd = x;
      darkCount += 1;
      gap = 0;
      continue;
    }

    if (runStart !== null) {
      gap += 1;
      if (gap > RASTER_MAX_RUN_GAP) {
        runEnd = Math.max(runStart, x - gap);
        flushRun();
      }
    }
  }

  flushRun();
  return runs;
};

const mergeRasterLineRuns = (runs: RasterLineRun[]) => {
  const sorted = [...runs].sort((a, b) => a.y - b.y || a.x1 - b.x1);
  const merged: RasterLineRun[] = [];

  for (const run of sorted) {
    const previous = merged[merged.length - 1];
    if (previous) {
      const yClose = run.y - previous.y <= RASTER_MAX_LINE_ROW_GAP;
      const overlap = Math.min(previous.x2, run.x2) - Math.max(previous.x1, run.x1);
      const minWidth = Math.max(1, Math.min(previous.x2 - previous.x1, run.x2 - run.x1));
      const xClose = overlap / minWidth >= 0.72 || Math.abs(run.x1 - previous.x1) <= 6;

      if (yClose && xClose) {
        previous.x1 = Math.min(previous.x1, run.x1);
        previous.x2 = Math.max(previous.x2, run.x2);
        previous.y = Math.round((previous.y + run.y) / 2);
        previous.darkCount += run.darkCount;
        continue;
      }
    }

    merged.push({ ...run });
  }

  return merged;
};

const detectRasterHorizontalRegions = async (
  pdfPage: PDFPageProxy,
  page: number,
  pageWidth: number,
  pageHeight: number
): Promise<DetectedBlankRegion[]> => {
  if (typeof document === "undefined") return [];

  const scale = Math.min(RASTER_MAX_SCALE, RASTER_MAX_RENDER_WIDTH / Math.max(1, pageWidth));
  const viewport = pdfPage.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const renderTask = pdfPage.render({
    canvasContext: context,
    viewport,
  });

  await renderTask.promise;

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const minRunWidthPx = Math.max(24, MIN_LINE_LENGTH * scale);
  const runs: RasterLineRun[] = [];

  for (let y = 0; y < canvas.height; y += 1) {
    runs.push(...findRasterLineRunsForRow(image.data, canvas.width, y, minRunWidthPx));
  }

  const mergedRuns = mergeRasterLineRuns(runs);
  const regions: DetectedBlankRegion[] = [];

  for (const run of mergedRuns) {
    const x = run.x1 / scale;
    const baselineY = run.y / scale;
    const w = (run.x2 - run.x1 + 1) / scale;

    const region = normalizeCandidate(
      {
        page,
        x,
        y: baselineY - DEFAULT_TEXT_BASELINE_FROM_TOP,
        w,
        h: DEFAULT_LINE_FIELD_HEIGHT,
        patternType: "horizontal-line",
        confidence: w >= 100 ? 0.79 : 0.74,
      },
      pageWidth,
      pageHeight
    );

    if (region) regions.push(region);
  }

  canvas.width = 0;
  canvas.height = 0;

  return regions;
};

const suppressDenseTextRegions = (
  regions: DetectedBlankRegion[],
  tokensByPage: Map<number, PdfTextToken[]>
) => {
  return regions.filter((region) => {
    const pageTokens = tokensByPage.get(region.page) || [];
    const expanded = {
      x1: region.x - 8,
      y1: region.y - 6,
      x2: region.x + region.w + 8,
      y2: region.y + region.h + 6,
    };

    const nearbyTextCount = pageTokens.filter((token) => {
      const overlapsX = token.x < expanded.x2 && token.x + token.w > expanded.x1;
      const overlapsY = token.y < expanded.y2 && token.y + token.h > expanded.y1;
      return overlapsX && overlapsY;
    }).length;

    return nearbyTextCount <= 4;
  });
};

const keepHighConfidenceOnly = (regions: DetectedBlankRegion[]) => {
  return regions.filter((region) => region.confidence >= 0.72);
};

export async function detectPdfBlankRegions(pdfDoc: PDFDocumentProxy): Promise<DetectionResult> {
  const regions: DetectedBlankRegion[] = [];
  const tokensByPage = new Map<number, PdfTextToken[]>();

  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;

    const tokens = await extractTextTokensForPage(page, pageNumber, pageWidth, pageHeight);
    tokensByPage.set(pageNumber, tokens);

    try {
      regions.push(
        ...(await detectRasterHorizontalRegions(page, pageNumber, pageWidth, pageHeight))
      );
    } catch (error) {
      console.warn(`Raster blank-region detection failed on page ${pageNumber}`, error);
    }
  }

  const highConfidence = keepHighConfidenceOnly(regions);
  const deduped = dedupeRegions(highConfidence);
  const noiseSuppressed = suppressDenseTextRegions(deduped, tokensByPage);

  return {
    regions: noiseSuppressed,
    tokensByPage,
  };
}
