import { IFormBlock } from "@betterinternship/core/forms";
import { computePreviewBaselineOffset } from "@betterinternship/core/pdf-viewer";
import {
  getDetectedRegionBaselineY,
  type MissingFieldSuggestion,
} from "@/lib/missing-fields/pipeline";
import { normalizeVerticalAlign } from "./pdf-editor-utils";

export const ALIGNMENT_HORIZONTAL_TOLERANCE = 28;
export const ALIGNMENT_VERTICAL_TOLERANCE = 120;
export const ALIGNMENT_MIN_BASELINE_Y = 6;
export const ALIGNMENT_MIN_DELTA = 0.25;

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  startA < endB && endA > startB;

const distanceBetweenRanges = (startA: number, endA: number, startB: number, endB: number) => {
  if (rangesOverlap(startA, endA, startB, endB)) return 0;
  return startA < startB ? startB - endA : startA - endB;
};

const centerInsideRect = (
  centerX: number,
  centerY: number,
  rect: { x: number; y: number; w: number; h: number },
  padding = 0
) =>
  centerX >= rect.x - padding &&
  centerX <= rect.x + rect.w + padding &&
  centerY >= rect.y - padding &&
  centerY <= rect.y + rect.h + padding;

export const resolveBaselineAlignmentCandidate = (
  block: IFormBlock,
  suggestions: MissingFieldSuggestion[]
) => {
  const schema = block.field_schema;
  if (!schema || block.block_type !== "form_field") return null;

  const fieldCenterX = schema.x + schema.w / 2;
  const fieldCenterY = schema.y + schema.h / 2;
  const fieldBaselineOffset = computePreviewBaselineOffset({
    fieldType: schema.type,
    fieldFont: schema.font,
    fontSize: schema.size,
    fieldHeight: schema.h,
    alignV: normalizeVerticalAlign(schema.align_v),
  });
  const currentBaselineY = schema.y + fieldBaselineOffset;

  let best: {
    baselineY: number;
    overlapsRegion: boolean;
    suggestionId: string;
    score: number;
  } | null = null;

  for (const suggestion of suggestions) {
    if (suggestion.page !== schema.page) continue;

    const suggestionBaselineY = getDetectedRegionBaselineY(suggestion);
    if (suggestionBaselineY < ALIGNMENT_MIN_BASELINE_Y) continue;

    const suggestionCenterX = suggestion.x + suggestion.w / 2;
    const suggestionCenterY = suggestion.y + suggestion.h / 2;
    const horizontalGap = distanceBetweenRanges(
      schema.x,
      schema.x + schema.w,
      suggestion.x,
      suggestion.x + suggestion.w
    );
    const overlapsX = rangesOverlap(
      schema.x,
      schema.x + schema.w,
      suggestion.x,
      suggestion.x + suggestion.w
    );
    const overlapsY = rangesOverlap(
      schema.y,
      schema.y + schema.h,
      suggestion.y,
      suggestion.y + suggestion.h
    );
    const overlapsRegion = overlapsX && overlapsY;
    const fieldCenterInSuggestion = centerInsideRect(fieldCenterX, fieldCenterY, suggestion, 8);
    const suggestionCenterInField = centerInsideRect(
      suggestionCenterX,
      suggestionCenterY,
      schema,
      8
    );
    const horizontallyClose =
      overlapsX ||
      horizontalGap <= ALIGNMENT_HORIZONTAL_TOLERANCE ||
      Math.abs(fieldCenterX - suggestionCenterX) <=
        Math.max(ALIGNMENT_HORIZONTAL_TOLERANCE, (schema.w + suggestion.w) / 2);
    const fieldVerticallyTouchesBaseline =
      suggestionBaselineY >= schema.y - ALIGNMENT_VERTICAL_TOLERANCE &&
      suggestionBaselineY <= schema.y + schema.h + ALIGNMENT_VERTICAL_TOLERANCE;
    const verticallyClose =
      Math.abs(currentBaselineY - suggestionBaselineY) <= ALIGNMENT_VERTICAL_TOLERANCE ||
      Math.abs(fieldCenterY - suggestionCenterY) <= ALIGNMENT_VERTICAL_TOLERANCE ||
      fieldVerticallyTouchesBaseline;
    const sameRowCandidate =
      Math.abs(currentBaselineY - suggestionBaselineY) <= ALIGNMENT_VERTICAL_TOLERANCE &&
      horizontalGap <= Math.max(ALIGNMENT_HORIZONTAL_TOLERANCE, schema.w, suggestion.w);
    const eligibleCandidate =
      overlapsRegion ||
      fieldCenterInSuggestion ||
      suggestionCenterInField ||
      (horizontallyClose && verticallyClose) ||
      sameRowCandidate;

    if (!eligibleCandidate) continue;

    const baselineDistance = Math.abs(currentBaselineY - suggestionBaselineY);
    const centerDistance = Math.hypot(
      fieldCenterX - suggestionCenterX,
      fieldCenterY - suggestionCenterY
    );
    const score =
      baselineDistance * 4 +
      horizontalGap * 1.5 +
      centerDistance * 0.25 -
      (overlapsRegion ? 40 : 0) -
      (overlapsX ? 20 : 0) -
      (fieldCenterInSuggestion || suggestionCenterInField ? 12 : 0) -
      (horizontallyClose && verticallyClose ? 8 : 0) -
      (sameRowCandidate ? 8 : 0);

    if (!best || score < best.score) {
      best = {
        baselineY: suggestionBaselineY,
        overlapsRegion,
        suggestionId: suggestion.id,
        score,
      };
    }
  }

  if (!best) return null;

  return {
    overlapsRegion: best.overlapsRegion,
    score: best.score,
    suggestionId: best.suggestionId,
    y: Math.max(0, best.baselineY - fieldBaselineOffset),
  };
};
