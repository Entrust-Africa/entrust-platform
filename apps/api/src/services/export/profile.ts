import type { OpportunityProfile } from "@entrust/summit-engine";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { drawable, wrap } from "./pdf";

// The one-page profile of a selected SME as a PDF (#80): the business's name, then its facts in a few sections. It is for
// Entrust's own use, and says so at the foot. One page is a rule, not a hope: a long answer is shortened until
// everything fits.

const PAGE = { width: 595, height: 842 } as const;
const MARGIN = 42;
const BOTTOM = 56;
const LABEL_WIDTH = 132;
const SIZE = 9;
const LINE = 11.5;
const INK = rgb(0.1, 0.12, 0.11);
const MUTED = rgb(0.42, 0.45, 0.43);
const ACCENT = rgb(0.13, 0.35, 0.24);
const RULE = rgb(0.82, 0.85, 0.83);

/** How long a value may be before it is cut, tried from the most to the least generous until the page holds it. */
const LIMITS = [500, 320, 200, 120, 70];

const clip = (text: string, limit: number): string => (text.length <= limit ? text : `${text.slice(0, limit - 3).trimEnd()}...`);

export interface ProfileFile {
  generatedAt: Date;
  generatedBy: string;
  summit: string;
  classification: string;
}

export async function toProfilePdf(profile: OpportunityProfile, file: ProfileFile): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`${profile.businessName}: SME opportunity profile`);
  pdf.setSubject(file.summit);
  pdf.setAuthor(file.generatedBy);
  pdf.setProducer("Entrust platform");
  pdf.setCreator("Entrust platform");
  pdf.setCreationDate(file.generatedAt);
  pdf.setModificationDate(file.generatedAt);
  const page = pdf.addPage([PAGE.width, PAGE.height]);

  const text = (value: string, font: PDFFont) => drawable(value, font);
  const valueWidth = PAGE.width - MARGIN * 2 - LABEL_WIDTH;
  const nameLines = wrap(text(profile.businessName, bold), bold, 19, PAGE.width - MARGIN * 2);
  const headerHeight = 92 + nameLines.length * 23;

  // Shorten the values until the whole profile fits above the footer.
  const layout = (limit: number) =>
    profile.sections.map((section) => ({
      heading: section.heading,
      fields: section.fields.map((f) => ({ label: text(f.label, regular), lines: wrap(text(clip(f.value, limit), regular), regular, SIZE, valueWidth) })),
    }));
  const height = (sections: ReturnType<typeof layout>) =>
    sections.reduce((sum, s) => sum + 30 + s.fields.reduce((h, f) => h + f.lines.length * LINE + 5, 0), 0);
  const available = PAGE.height - BOTTOM - headerHeight;
  const sections = LIMITS.map(layout).find((candidate) => height(candidate) <= available) ?? layout(LIMITS[LIMITS.length - 1] as number);

  page.drawText(text(file.summit, bold), { x: MARGIN, y: PAGE.height - 38, size: 9, font: bold, color: ACCENT });
  const classification = text(file.classification.toUpperCase(), bold);
  page.drawText(classification, { x: PAGE.width - MARGIN - bold.widthOfTextAtSize(classification, 9), y: PAGE.height - 38, size: 9, font: bold, color: ACCENT });
  page.drawText("SME OPPORTUNITY PROFILE", { x: MARGIN, y: PAGE.height - 54, size: 8, font: bold, color: MUTED });
  page.drawLine({ start: { x: MARGIN, y: PAGE.height - 62 }, end: { x: PAGE.width - MARGIN, y: PAGE.height - 62 }, thickness: 0.6, color: RULE });

  let y = PAGE.height - 88;
  for (const line of nameLines) {
    page.drawText(line, { x: MARGIN, y, size: 19, font: bold, color: INK });
    y -= 23;
  }
  page.drawText(text(profile.reference, regular), { x: MARGIN, y: y + 6, size: 8.5, font: regular, color: MUTED });
  page.drawText(text(profile.confirmation, regular), { x: MARGIN, y: y - 6, size: 8.5, font: regular, color: MUTED });
  y -= 30;

  for (const section of sections) {
    page.drawText(text(section.heading.toUpperCase(), bold), { x: MARGIN, y, size: 9, font: bold, color: ACCENT });
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 0.4, color: RULE });
    y -= 16;
    for (const field of section.fields) {
      page.drawText(field.label, { x: MARGIN, y, size: SIZE - 0.5, font: regular, color: MUTED });
      field.lines.forEach((line, n) => page.drawText(line, { x: MARGIN + LABEL_WIDTH, y: y - n * LINE, size: SIZE, font: regular, color: INK }));
      y -= field.lines.length * LINE + 5;
    }
    y -= 8;
  }

  page.drawLine({ start: { x: MARGIN, y: 44 }, end: { x: PAGE.width - MARGIN, y: 44 }, thickness: 0.4, color: RULE });
  const notice = "For Entrust's own use. It isn't to be shared outside Entrust without the business's authorisation.";
  page.drawText(text(notice, regular), { x: MARGIN, y: 32, size: 7.5, font: regular, color: MUTED });
  page.drawText(text(`Generated ${file.generatedAt.toISOString().replace("T", " ").slice(0, 16)} UTC by ${file.generatedBy}`, regular), {
    x: MARGIN,
    y: 21,
    size: 7.5,
    font: regular,
    color: MUTED,
  });
  return pdf.save();
}
