export interface FieldRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SnapResult {
  x: number | null;
  y: number | null;
  guideX: number | null;
  guideY: number | null;
}

export function computeSnapToGrid(
  dragged: FieldRect,
  targets: FieldRect[],
  threshold: number,
): SnapResult {
  const dl = dragged.x;
  const dr = dragged.x + dragged.w;
  const dt = dragged.y;
  const db = dragged.y + dragged.h;
  const dcx = dragged.x + dragged.w / 2;
  const dcy = dragged.y + dragged.h / 2;

  let bestSnapX: number | null = null;
  let bestSnapY: number | null = null;
  let bestGuideX: number | null = null;
  let bestGuideY: number | null = null;
  let bestDistX = threshold;
  let bestDistY = threshold;

  for (const t of targets) {
    if (t.id === dragged.id) continue;

    const tl = t.x;
    const tr = t.x + t.w;
    const tt = t.y;
    const tb = t.y + t.h;
    const tcx = t.x + t.w / 2;
    const tcy = t.y + t.h / 2;

    // X-axis: left-to-left, left-to-right, right-to-left, right-to-right, center-to-center
    const xTests: [number, number, number, number][] = [
      [dl, tl, tl, tl],
      [dl, tr, tr, tr],
      [dr, tl, tl, tl - dragged.w],
      [dr, tr, tr, tr - dragged.w],
      [dcx, tcx, tcx, tcx - dragged.w / 2],
    ];
    for (const [dEdge, tEdge, gPos, sPos] of xTests) {
      const dist = Math.abs(dEdge - tEdge);
      if (dist < bestDistX) {
        bestDistX = dist;
        bestSnapX = sPos;
        bestGuideX = gPos;
      }
    }

    // Y-axis: top-to-top, top-to-bottom, bottom-to-top, bottom-to-bottom, center-to-center
    const yTests: [number, number, number, number][] = [
      [dt, tt, tt, tt],
      [dt, tb, tb, tb],
      [db, tt, tt, tt - dragged.h],
      [db, tb, tb, tb - dragged.h],
      [dcy, tcy, tcy, tcy - dragged.h / 2],
    ];
    for (const [dEdge, tEdge, gPos, sPos] of yTests) {
      const dist = Math.abs(dEdge - tEdge);
      if (dist < bestDistY) {
        bestDistY = dist;
        bestSnapY = sPos;
        bestGuideY = gPos;
      }
    }
  }

  return { x: bestSnapX, y: bestSnapY, guideX: bestGuideX, guideY: bestGuideY };
}

export interface ResizeSnapResult {
  left: number;
  top: number;
  w: number;
  h: number;
  guideX: number | null;
  guideY: number | null;
}

export function snapResizeEdge(
  handle: string,
  left: number,
  top: number,
  w: number,
  h: number,
  fieldId: string,
  targets: FieldRect[],
  threshold: number,
): ResizeSnapResult {
  const right = left + w;
  const bottom = top + h;

  let outLeft = left;
  let outTop = top;
  let outW = w;
  let outH = h;
  let guideX: number | null = null;
  let guideY: number | null = null;

  const movesLeft = handle === "w" || handle === "nw" || handle === "sw";
  const movesRight = handle === "e" || handle === "ne" || handle === "se";
  const movesTop = handle === "n" || handle === "nw" || handle === "ne";
  const movesBottom = handle === "s" || handle === "sw" || handle === "se";

  let bestDistX = threshold;
  let bestDistY = threshold;

  for (const t of targets) {
    if (t.id === fieldId) continue;

    const tl = t.x;
    const tr = t.x + t.w;
    const tt = t.y;
    const tb = t.y + t.h;

    if (movesLeft) {
      for (const tEdge of [tl, tr]) {
        const dist = Math.abs(left - tEdge);
        if (dist < bestDistX) {
          bestDistX = dist;
          const snapCorrection = tEdge - left;
          outLeft += snapCorrection;
          outW -= snapCorrection;
          guideX = tEdge;
        }
      }
    }

    if (movesRight) {
      for (const tEdge of [tl, tr]) {
        const dist = Math.abs(right - tEdge);
        if (dist < bestDistX) {
          bestDistX = dist;
          outW = tEdge - left;
          guideX = tEdge;
        }
      }
    }

    if (movesTop) {
      for (const tEdge of [tt, tb]) {
        const dist = Math.abs(top - tEdge);
        if (dist < bestDistY) {
          bestDistY = dist;
          const snapCorrection = tEdge - top;
          outTop += snapCorrection;
          outH -= snapCorrection;
          guideY = tEdge;
        }
      }
    }

    if (movesBottom) {
      for (const tEdge of [tt, tb]) {
        const dist = Math.abs(bottom - tEdge);
        if (dist < bestDistY) {
          bestDistY = dist;
          outH = tEdge - top;
          guideY = tEdge;
        }
      }
    }
  }

  return { left: outLeft, top: outTop, w: outW, h: outH, guideX, guideY };
}
