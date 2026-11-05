import { unzipSync } from "fflate";
import type { Cell, SheetGrid } from "@entrust/trade-engine";
import { ServiceError } from "./errors";

// Reads the sheets of an .xlsx file as rows of cells, enough for the register: text, numbers and blanks. A formula's last
// calculated value is what is read. An .xlsx is a zip of XML files, and `fflate` is already here for writing them.

const MAX_PART_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_COLUMNS = 100;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });

/** The text inside the `<t>` elements of a fragment, leaving out phonetic hints. */
const textOf = (fragment: string) =>
  [...fragment.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1] ?? "")).join("");

const attribute = (attributes: string, name: string) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attributes)?.[1];

/** "AB12" as the zero-based column 27. */
const columnOf = (reference: string): number => {
  let column = 0;
  for (const ch of /^[A-Z]+/i.exec(reference)?.[0].toUpperCase() ?? "") column = column * 26 + ch.charCodeAt(0) - 64;
  return column - 1;
};

const rowOf = (reference: string): number => Number(/\d+$/.exec(reference)?.[0] ?? 0) - 1;

const text = (bytes: Uint8Array) => new TextDecoder("utf-8").decode(bytes);

function readSheet(xml: string, shared: readonly string[]): SheetGrid {
  const rows: Cell[][] = [];
  for (const match of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attributes = match[1] ?? "";
    const reference = attribute(attributes, "r");
    if (!reference) continue;
    const r = rowOf(reference);
    const c = columnOf(reference);
    if (r < 0 || c < 0 || r >= MAX_ROWS || c >= MAX_COLUMNS) continue;
    const body = match[2] ?? "";
    const type = attribute(attributes, "t");
    const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1];
    let value: Cell = null;
    if (type === "inlineStr") value = textOf(body);
    else if (raw !== undefined) {
      if (type === "s") value = shared[Number(raw)] ?? null;
      else if (type === "str") value = decode(raw);
      else if (type === "b" || type === "e" || type === "d") value = null;
      else {
        const n = Number(raw);
        value = Number.isFinite(n) ? n : null;
      }
    }
    if (value === null) continue;
    const row = (rows[r] ??= []);
    while (row.length < c) row.push(null);
    row[c] = value;
  }
  // Rows the file never mentions are empty rows, not holes.
  return Array.from({ length: rows.length }, (_, i) => rows[i] ?? []);
}

/** The sheets of an .xlsx file by name. Throws a `ServiceError` fit to show when the file isn't a workbook. */
export function readWorkbookSheets(bytes: Uint8Array): Record<string, SheetGrid> {
  let parts: Record<string, Uint8Array>;
  try {
    parts = unzipSync(bytes, {
      filter: (file) => {
        if (file.originalSize > MAX_PART_BYTES) throw new Error("part too large");
        return /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(file.name);
      },
    });
  } catch {
    throw new ServiceError("invalid", "That isn't an Excel workbook (.xlsx), or it is too large to read.");
  }
  const workbook = parts["xl/workbook.xml"];
  const relationships = parts["xl/_rels/workbook.xml.rels"];
  if (!workbook || !relationships) throw new ServiceError("invalid", "That isn't an Excel workbook (.xlsx).");

  const targets = new Map<string, string>();
  for (const m of text(relationships).matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const id = attribute(m[1] ?? "", "Id");
    const target = attribute(m[1] ?? "", "Target");
    if (id && target) targets.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }

  const shared = parts["xl/sharedStrings.xml"]
    ? [...text(parts["xl/sharedStrings.xml"]).matchAll(/<si\s*\/>|<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1] ?? ""))
    : [];

  const sheets: Record<string, SheetGrid> = {};
  for (const m of text(workbook).matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const name = attribute(m[1] ?? "", "name");
    const id = /\br:id="([^"]*)"/.exec(m[1] ?? "")?.[1];
    const part = id ? parts[targets.get(id) ?? ""] : undefined;
    if (name && part) sheets[decode(name)] = readSheet(text(part), shared);
  }
  return sheets;
}
