import { strToU8, zipSync } from "fflate";

// Builds an .xlsx file for the tests: a zip of the XML files Excel writes.

export type Cell = string | number | null;
/** A cell written as an inline string, or as a formula with its saved result. */
export type Extra = { inline: string } | { formula: string; value: number | string };
/** A column number as Excel's letters: 0 is A, 26 is AA. */
const column = (index: number): string => {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
};
const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** An .xlsx file with the given sheets. Text goes in the shared strings, the way Excel writes it; `{ inline }` and `{ formula }` cells exercise the other two ways. */
export function workbook(sheets: Record<string, (Cell | Extra)[][]>): Uint8Array {
  const shared: string[] = [];
  const sharedIndex = (text: string) => (shared.includes(text) ? shared.indexOf(text) : shared.push(text) - 1);
  const names = Object.keys(sheets);
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
        .map((n, i) => `<sheet name="${escape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="x" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}</Relationships>`,
    ),
  };
  names.forEach((name, s) => {
    const rows = sheets[name]!.map((cells, r) => {
      const xml = cells
        .map((value, c) => {
          const ref = `${column(c)}${r + 1}`;
          if (value === null) return `<c r="${ref}" s="1"/>`;
          if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
          if (typeof value === "string") return `<c r="${ref}" t="s"><v>${sharedIndex(value)}</v></c>`;
          if ("inline" in value) return `<c r="${ref}" t="inlineStr"><is><t>${escape(value.inline)}</t></is></c>`;
          return typeof value.value === "number"
            ? `<c r="${ref}"><f>${escape(value.formula)}</f><v>${value.value}</v></c>`
            : `<c r="${ref}" t="str"><f>${escape(value.formula)}</f><v>${escape(value.value)}</v></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${xml}</row>`;
    });
    files[`xl/worksheets/sheet${s + 1}.xml`] = strToU8(`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join("")}</sheetData></worksheet>`);
  });
  files["xl/sharedStrings.xml"] = strToU8(`<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${shared.map((t) => `<si><t xml:space="preserve">${escape(t)}</t></si>`).join("")}</sst>`);
  return zipSync(files);
}

