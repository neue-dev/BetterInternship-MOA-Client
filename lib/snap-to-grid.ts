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
