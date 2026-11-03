import { detailsOf, type ExportCell, type ExportTable } from "./table";

// CSV for importing the records into other systems. A cell a spreadsheet would run as a formula is made plain text,
// so a business that names itself "=HYPERLINK(...)" can't act on whoever opens the file.

/** A phone number such as +251 911 000 000 starts with a plus but holds nothing a spreadsheet could run. */
const PLAIN_NUMBER = /^[+-]\d[\d\s().-]*$/;

export function csvCell(cell: ExportCell): string {
  if (cell === null) return "";
  // A figure is a number, not text that starts with a minus sign, so it is written as it is.
  if (typeof cell === "number") return String(cell);
  let text = cell;
  if (/^[=+\-@\t\r]/.test(text) && !PLAIN_NUMBER.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const line = (cells: readonly ExportCell[]): string => cells.map(csvCell).join(",");

/**
 * The report as UTF-8 CSV, with a byte order mark so Excel reads the accents. The details the specification asks of every
 * export come first, then a blank line, then the column names and the records.
 */
export function toCsv(table: ExportTable): Uint8Array {
  const lines = [
    ...detailsOf(table).map(([label, value]) => line([label, value])),
    "",
    line(table.columns.map((c) => c.label)),
    ...table.rows.map(line),
  ];
  return new TextEncoder().encode(`﻿${lines.join("\r\n")}\r\n`);
}
