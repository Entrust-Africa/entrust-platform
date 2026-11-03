import { toCsv } from "./csv";
import { toPdf } from "./pdf";
import type { ExportTable } from "./table";
import { toXlsx } from "./xlsx";

export type { ExportCell, ExportTable } from "./table";
export { csvCell } from "./csv";
export { columnName } from "./xlsx";
export { toProfilePdf } from "./profile";
export type { ProfileFile } from "./profile";

export const EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const CONTENT_TYPES: Readonly<Record<ExportFormat, string>> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

/** The table as a file of the format asked for. */
export async function render(table: ExportTable, format: ExportFormat): Promise<Uint8Array> {
  switch (format) {
    case "csv":
      return toCsv(table);
    case "xlsx":
      return toXlsx(table);
    case "pdf":
      return toPdf(table);
  }
}
