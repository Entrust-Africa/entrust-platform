// What a sponsor may see of a programme report (#72). A figure built from fewer than five SMEs could point at a
// particular business, so a sponsor doesn't see it, unless every one of those SMEs agreed to share that kind of data.

export const MINIMUM_SMES_IN_A_FIGURE = 5;

/** Whether a figure built from these SMEs may be shown. A figure built from nobody is a plain zero. */
export function figureIsVisible(smes: ReadonlySet<string>, consenting: ReadonlySet<string>): boolean {
  if (smes.size === 0 || smes.size >= MINIMUM_SMES_IN_A_FIGURE) return true;
  return [...smes].every((sme) => consenting.has(sme));
}

export interface GroupCell {
  value: number;
  smes: ReadonlySet<string>;
}

/**
 * Cells that add up to a total the reader can see, such as enrolments by status. Hiding one cell isn't enough, because
 * the total minus the others gives it back, so the next smallest cell is hidden with it.
 */
export function protectGroup(cells: readonly GroupCell[], consenting: ReadonlySet<string>, totalIsVisible = true): (number | null)[] {
  const hidden = new Set(cells.flatMap((cell, index) => (figureIsVisible(cell.smes, consenting) ? [] : [index])));
  if (hidden.size === 1 && totalIsVisible) {
    let smallest: number | null = null;
    cells.forEach((cell, index) => {
      if (hidden.has(index) || cell.smes.size === 0) return;
      if (smallest === null || cell.smes.size < cells[smallest]!.smes.size) smallest = index;
    });
    if (smallest !== null) hidden.add(smallest);
  }
  return cells.map((cell, index) => (hidden.has(index) ? null : cell.value));
}
