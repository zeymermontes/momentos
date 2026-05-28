const SHEET_W_INCH = 13;
const SHEET_H_INCH = 19;
const DPI = 300;
export const PRINT_DPI = DPI;
export const SHEET_W_PX = SHEET_W_INCH * DPI;
export const SHEET_H_PX = SHEET_H_INCH * DPI;

export type SheetLayout = {
  pagePx: number;
  cols: number;
  rows: number;
  pagesPerSide: number;
  marginX: number;
  marginY: number;
};

export type SheetPlan = {
  front: (number | null)[];
  back: (number | null)[];
};

export function getSheetLayout(sizeCm: number): SheetLayout {
  const pagePx = Math.round((sizeCm / 2.54) * DPI);
  const cols = Math.floor(SHEET_W_PX / pagePx);
  const rows = Math.floor(SHEET_H_PX / pagePx);
  const pagesPerSide = cols * rows;
  const marginX = Math.round((SHEET_W_PX - cols * pagePx) / 2);
  const marginY = Math.round((SHEET_H_PX - rows * pagePx) / 2);
  return { pagePx, cols, rows, pagesPerSide, marginX, marginY };
}

/**
 * Generate sheet plans for all pages of a photobook.
 *
 * Front side: odd-numbered pages (1, 3, 5, ...).
 * Back side: even-numbered pages (2, 4, 6, ...) with columns mirrored
 * so that page 2 is physically behind page 1 after flipping the sheet
 * on the long-side axis.
 */
export function generateSheetPlans(
  totalPages: number,
  sizeCm: number,
): { sheets: SheetPlan[]; layout: SheetLayout } {
  const layout = getSheetLayout(sizeCm);
  const { cols, pagesPerSide } = layout;
  const sheets: SheetPlan[] = [];

  let sheetBase = 0;

  while (sheetBase < totalPages) {
    const front: (number | null)[] = new Array(pagesPerSide).fill(null);
    const back: (number | null)[] = new Array(pagesPerSide).fill(null);

    for (let i = 0; i < pagesPerSide; i++) {
      const oddPage = sheetBase + i * 2 + 1;
      const evenPage = oddPage + 1;

      const col = i % cols;
      const row = Math.floor(i / cols);
      const frontIdx = row * cols + col;
      const mirroredCol = cols - 1 - col;
      const backIdx = row * cols + mirroredCol;

      if (oddPage <= totalPages) front[frontIdx] = oddPage;
      if (evenPage <= totalPages) back[backIdx] = evenPage;
    }

    sheets.push({ front, back });
    sheetBase += pagesPerSide * 2;
  }

  return { sheets, layout };
}
