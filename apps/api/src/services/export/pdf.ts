import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { detailsOf, displayCell, type ExportTable } from "./table";

// The report as a PDF for formal reporting and committee papers: landscape A4, the Summit's name, the report's title, the
// date it was generated and its confidentiality classification on every page. Each record is a block of labelled fields,
// since a report of 20 columns doesn't fit across a page. The standard fonts hold Latin text only, so a letter they
// can't draw (Ge'ez, for instance) shows as "?" here; the Excel and CSV files keep it.

const PAGE = { width: 842, height: 595 } as const;
const MARGIN = 36;
const TOP = 62;
const BOTTOM = 40;
const COLUMNS = 4;
const GAP = 12;
const INK = rgb(0.1, 0.12, 0.11);
const MUTED = rgb(0.42, 0.45, 0.43);
const ACCENT = rgb(0.13, 0.35, 0.24);
const RULE = rgb(0.82, 0.85, 0.83);

const LABEL_SIZE = 6.5;
const VALUE_SIZE = 8.5;
const LINE = 10.5;

/** The text with every letter the font can't draw replaced by "?", and line breaks made spaces. */
export function drawable(text: string, font: PDFFont): string {
  const known = new Set(font.getCharacterSet());
  return Array.from(text.replace(/\s+/g, " "))
    .map((ch) => (known.has(ch.codePointAt(0) as number) ? ch : "?"))
    .join("");
}

/** The text broken into lines no wider than `width`; a word longer than a line is cut. */
export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  const push = (word: string) => {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    current = "";
    let rest = word;
    while (font.widthOfTextAtSize(rest, size) > width) {
      let cut = rest.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut -= 1;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    current = rest;
  };
  for (const word of text.split(" ")) if (word) push(word);
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function toPdf(table: ExportTable): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(table.title);
  pdf.setSubject(`${table.summit}: ${table.period}`);
  pdf.setAuthor(table.generatedBy);
  pdf.setProducer("Entrust platform");
  pdf.setCreator("Entrust platform");
  pdf.setCreationDate(table.generatedAt);
  pdf.setModificationDate(table.generatedAt);

  const text = (value: string, font: PDFFont = regular) => drawable(value, font);
  const classification = text(table.classification.toUpperCase(), bold);
  const contentWidth = PAGE.width - MARGIN * 2;
  const columnWidth = (contentWidth - GAP * (COLUMNS - 1)) / COLUMNS;

  let page: PDFPage = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - TOP;

  const startPage = (first: boolean) => {
    if (!first) page = pdf.addPage([PAGE.width, PAGE.height]);
    page.drawText(text(table.summit, bold), { x: MARGIN, y: PAGE.height - 28, size: 9, font: bold, color: ACCENT });
    page.drawText(text(table.title), { x: MARGIN, y: PAGE.height - 44, size: 13, font: bold, color: INK });
    page.drawText(classification, { x: PAGE.width - MARGIN - bold.widthOfTextAtSize(classification, 9), y: PAGE.height - 28, size: 9, font: bold, color: ACCENT });
    page.drawLine({ start: { x: MARGIN, y: PAGE.height - 52 }, end: { x: PAGE.width - MARGIN, y: PAGE.height - 52 }, thickness: 0.6, color: RULE });
    y = PAGE.height - TOP - 6;
  };
  startPage(true);

  // The details the specification asks of every export, in a grid at the head of the first page.
  const details = detailsOf(table).filter(([label]) => label !== "Summit" && label !== "Report");
  let rowTop = y;
  let rowHeight = 0;
  details.forEach(([label, value], i) => {
    const column = i % COLUMNS;
    if (column === 0) {
      rowTop -= rowHeight + 6;
      rowHeight = 0;
    }
    const x = MARGIN + column * (columnWidth + GAP);
    const lines = wrap(text(value || "None"), regular, VALUE_SIZE, columnWidth);
    page.drawText(text(label.toUpperCase(), bold), { x, y: rowTop, size: LABEL_SIZE, font: bold, color: MUTED });
    lines.forEach((l, n) => page.drawText(l, { x, y: rowTop - 10 - n * LINE, size: VALUE_SIZE, font: regular, color: INK }));
    rowHeight = Math.max(rowHeight, 10 + lines.length * LINE);
  });
  y = rowTop - rowHeight - 10;
  page.drawText(text(table.purpose), { x: MARGIN, y, size: 8.5, font: regular, color: MUTED });
  y -= 20;

  if (table.rows.length === 0) page.drawText("No records match.", { x: MARGIN, y, size: 10, font: bold, color: INK });

  table.rows.forEach((row) => {
    const heading = text(row.slice(0, table.titleCells).map(displayCell).filter(Boolean).join("  |  "), bold);
    const fields = table.columns
      .map((column, i) => ({ label: text(column.label.toUpperCase(), bold), lines: wrap(text(displayCell(row[i] ?? null) || "-"), regular, VALUE_SIZE, columnWidth) }))
      .slice(table.titleCells);

    // Lay the fields out in rows of four, each row as tall as its tallest field.
    const rows: (typeof fields)[] = [];
    for (let i = 0; i < fields.length; i += COLUMNS) rows.push(fields.slice(i, i + COLUMNS));
    const heights = rows.map((r) => 10 + Math.max(...r.map((f) => f.lines.length)) * LINE + 4);
    const total = 16 + heights.reduce((sum, h) => sum + h, 0) + 8;

    // A block starts on a fresh page if it won't fit, unless it is already at the top of one.
    if (y - total < BOTTOM && y < PAGE.height - TOP - 40) startPage(false);
    page.drawText(heading, { x: MARGIN, y, size: 10, font: bold, color: ACCENT });
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 0.4, color: RULE });
    y -= 12;
    rows.forEach((fieldRow, r) => {
      // A block taller than a page runs on to the next.
      if (y - heights[r]! < BOTTOM) startPage(false);
      fieldRow.forEach((field, c) => {
        const x = MARGIN + c * (columnWidth + GAP);
        page.drawText(field.label, { x, y, size: LABEL_SIZE, font: bold, color: MUTED });
        field.lines.forEach((l, n) => page.drawText(l, { x, y: y - 10 - n * LINE, size: VALUE_SIZE, font: regular, color: INK }));
      });
      y -= heights[r]!;
    });
    y -= 8;
  });

  // The footer is drawn last, when the number of pages is known.
  const pages = pdf.getPages();
  const generated = text(`Generated ${table.generatedAt.toISOString().replace("T", " ").slice(0, 16)} UTC by ${table.generatedBy}`);
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: 30 }, end: { x: PAGE.width - MARGIN, y: 30 }, thickness: 0.4, color: RULE });
    p.drawText(`${text(table.title)}  |  ${classification}  |  ${generated}`, { x: MARGIN, y: 18, size: 7, font: regular, color: MUTED });
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: PAGE.width - MARGIN - regular.widthOfTextAtSize(label, 7), y: 18, size: 7, font: regular, color: MUTED });
  });
  return pdf.save();
}
