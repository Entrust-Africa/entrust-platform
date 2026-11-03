import { zipSync, strToU8 } from "fflate";
import { detailsOf, type ExportCell, type ExportTable } from "./table";

// An Excel workbook (.xlsx) written by hand: a zip of a few XML files. One sheet holds the records, ready to filter, and
// a second holds the details of the export. Text is stored as text, so a cell that starts with "=" is never a formula.

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';

// Excel can't hold control characters other than tab, line feed and carriage return.
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const escape = (text: string): string =>
  text.replace(ILLEGAL, "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** A column number as Excel's letters: 0 is A, 26 is AA. */
export function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/** A cell's style: 0 plain, 1 the header, 2 a label, 3 wrapped text. */
type Style = 0 | 1 | 2 | 3;

function cell(reference: string, value: ExportCell, style: Style): string {
  const s = style ? ` s="${style}"` : "";
  if (value === null) return style ? `<c r="${reference}"${s}/>` : "";
  if (typeof value === "number") return Number.isFinite(value) ? `<c r="${reference}"${s}><v>${value}</v></c>` : "";
  return `<c r="${reference}"${s} t="inlineStr"><is><t xml:space="preserve">${escape(value)}</t></is></c>`;
}

function sheet(rows: readonly (readonly [ExportCell, Style][])[], options: { widths: number[]; header?: boolean; filterColumns?: number }): string {
  const body = rows
    .map((cells, r) => `<row r="${r + 1}">${cells.map(([value, style], c) => cell(`${columnName(c)}${r + 1}`, value, style)).join("")}</row>`)
    .join("");
  const columns = options.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const frozen = options.header ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : "";
  const filter = options.header && options.filterColumns ? `<autoFilter ref="A1:${columnName(options.filterColumns - 1)}${rows.length}"/>` : "";
  return `${XML}<worksheet ${NS}>${frozen}<cols>${columns}</cols><sheetData>${body}</sheetData>${filter}</worksheet>`;
}

const STYLES = `${XML}<styleSheet ${NS}>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7ECE8"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
</styleSheet>`;

/** Wide enough for the header and the longest of the first rows, within what reads well on screen. */
function widthOf(label: string, values: readonly ExportCell[]): number {
  const longest = Math.max(label.length, ...values.slice(0, 200).map((v) => (v === null ? 0 : String(v).length)));
  return Math.min(60, Math.max(12, longest + 2));
}

export function toXlsx(table: ExportTable): Uint8Array {
  const records = [
    table.columns.map((c): [ExportCell, Style] => [c.label, 1]),
    ...table.rows.map((row) => row.map((value): [ExportCell, Style] => [value, typeof value === "string" && value.length > 60 ? 3 : 0])),
  ];
  const widths = table.columns.map((c, i) => widthOf(c.label, table.rows.map((r) => r[i] ?? null)));
  const details = detailsOf(table).map(([label, value]): [ExportCell, Style][] => [[label, 2], [value, 3]]);

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `${XML}<workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/><sheet name="Export details" sheetId="2" r:id="rId2"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Report!$A$1:$${columnName(table.columns.length - 1)}$${table.rows.length + 1}</definedName></definedNames></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": strToU8(STYLES),
    "xl/worksheets/sheet1.xml": strToU8(sheet(records, { widths, header: true, filterColumns: table.columns.length })),
    "xl/worksheets/sheet2.xml": strToU8(sheet(details, { widths: [20, 80] })),
  };
  // A fixed modification time keeps the same report byte for byte the same.
  return zipSync(files, { level: 6, mtime: table.generatedAt });
}
