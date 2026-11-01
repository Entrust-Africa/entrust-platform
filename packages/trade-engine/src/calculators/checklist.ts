export interface ChecklistItem {
  id: string;
  /** Provided: the document is uploaded, or the item is marked done. */
  provided: boolean;
}

export interface ChecklistCompletion {
  provided: number;
  total: number;
  /** Whole percent, rounded down, so 100 means every item is provided. */
  percent: number;
  /** The items still to provide, in the order given. */
  missing: readonly string[];
}

/** M03's financial information pack (acceptance test 11): how much of the checklist is provided. */
export function checklistCompletion(items: readonly ChecklistItem[]): ChecklistCompletion {
  if (!items.length) throw new RangeError("a checklist needs at least one item");
  const ids = items.map((i) => i.id);
  const repeated = ids.find((id, i) => ids.indexOf(id) !== i);
  if (repeated !== undefined) throw new RangeError(`checklist item ${repeated} is listed twice`);
  const provided = items.filter((i) => i.provided).length;
  return {
    provided,
    total: items.length,
    percent: Math.floor((provided / items.length) * 100),
    missing: items.filter((i) => !i.provided).map((i) => i.id),
  };
}
