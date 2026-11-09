import type { ReactNode } from "react";

// Lesson and worked-example text is written in Markdown. This renders the small part of it that content uses (headings,
// paragraphs, lists, quotes, code, tables, bold, italics, links) as React elements, so nothing is ever put in as raw HTML.

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "rule" };

const FENCE = /^\s*```/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

const startsBlock = (line: string): boolean =>
  FENCE.test(line) || HEADING.test(line) || RULE.test(line) || BULLET.test(line) || NUMBERED.test(line) || QUOTE.test(line);

/** Splits Markdown into blocks. A blank line ends a paragraph; a line break inside one reads as a space, as in Markdown. */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") {
      i++;
      continue;
    }

    if (FENCE.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i]!)) body.push(lines[i++]!);
      i++; // the closing fence, if there is one
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1]!.length, text: heading[2]! });
      i++;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ kind: "rule" });
      i++;
      continue;
    }

    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const pattern = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i]!;
        const match = pattern.exec(current);
        if (match) {
          items.push(match[1]!);
          i++;
        } else if (current.trim() === "") {
          // A blank line keeps the list going only when the next line is another item of the same kind.
          let next = i + 1;
          while (next < lines.length && lines[next]!.trim() === "") next++;
          if (next < lines.length && pattern.test(lines[next]!)) i = next;
          else break;
        } else if (/^\s{2,}\S/.test(current) && !startsBlock(current)) {
          items[items.length - 1] += ` ${current.trim()}`; // a wrapped line of the item above
          i++;
        } else {
          break;
        }
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i]!)) body.push(QUOTE.exec(lines[i++]!)![1]!);
      blocks.push({ kind: "quote", text: body.join(" ").trim() });
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1]!) && lines[i + 1]!.includes("-")) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.trim() !== "" && lines[i]!.includes("|")) rows.push(cells(lines[i++]!));
      blocks.push({ kind: "table", head, rows });
      continue;
    }

    const body: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !startsBlock(lines[i]!)) body.push(lines[i++]!.trim());
    blocks.push({ kind: "paragraph", text: body.join(" ") });
  }

  return blocks;
}

// Code, **bold**, *italic* and [text](link), earliest first. A link goes only to http(s), mailto or a path on this site.
// No lookbehind, which older phones' browsers can't parse, and no underscore forms, which mangle words like snake_case.
const INLINE = /`([^`]+)`|\*\*([^*]+?)\*\*|\*([^*\s][^*]*?)\*|\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/(?!\/))[^)\s]*)\)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0;
    const [, code, bold, italic, label, href] = match;
    // A * touching a letter or digit on either side is a multiplication sign, not italics: 2*3*4.
    if (italic !== undefined && (/\w/.test(text[at - 1] ?? "") || /\w/.test(text[at + match[0].length] ?? ""))) continue;
    if (at > last) out.push(text.slice(last, at));
    const key = `${keyPrefix}-${n++}`;
    if (code !== undefined) {
      out.push(
        <code key={key} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.9em]">
          {code}
        </code>,
      );
    } else if (bold !== undefined) {
      out.push(
        <strong key={key} className="font-semibold">
          {inline(bold, key)}
        </strong>,
      );
    } else if (italic !== undefined) {
      out.push(<em key={key}>{inline(italic, key)}</em>);
    } else if (label !== undefined && href !== undefined) {
      const external = /^https?:/.test(href);
      out.push(
        <a
          key={key}
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
        >
          {inline(label, key)}
        </a>,
      );
    }
    last = at + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const HEADING_STYLES = [
  "text-lg font-bold", // h3 on the page: the lesson's own title is the h2
  "text-base font-bold",
  "text-sm font-bold uppercase tracking-wide text-ink-2",
  "text-sm font-semibold text-ink-2",
];

const sameTitle = (a: string, b: string) => a.trim().replace(/[.:\s]+$/, "").toLowerCase() === b.trim().replace(/[.:\s]+$/, "").toLowerCase();

/**
 * Renders Markdown with the site's type. Headings start at h3, because the lesson's title above it is the h2.
 * `dropLeadingTitle` removes a first heading that only repeats that title.
 */
export function Markdown({ source, dropLeadingTitle, className = "" }: { source: string; dropLeadingTitle?: string; className?: string }) {
  let blocks = parseMarkdown(source);
  const first = blocks[0];
  if (dropLeadingTitle && first?.kind === "heading" && sameTitle(first.text, dropLeadingTitle)) blocks = blocks.slice(1);

  return (
    <div className={`space-y-4 break-words text-[15px] leading-7 text-ink ${className}`}>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.kind) {
          case "heading": {
            const level = Math.min(block.level + 2, 6);
            const Tag = `h${level}` as "h3" | "h4" | "h5" | "h6";
            return (
              <Tag key={key} className={`font-display leading-snug text-ink ${HEADING_STYLES[Math.min(block.level - 1, 3)]} ${index > 0 ? "pt-2" : ""}`}>
                {inline(block.text, key)}
              </Tag>
            );
          }
          case "paragraph":
            return <p key={key}>{inline(block.text, key)}</p>;
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List key={key} className={`space-y-1.5 pl-6 marker:text-brand-600 ${block.ordered ? "list-decimal" : "list-disc"}`}>
                {block.items.map((item, n) => (
                  <li key={n} className="pl-1">
                    {inline(item, `${key}-${n}`)}
                  </li>
                ))}
              </List>
            );
          }
          case "quote":
            return (
              <blockquote key={key} className="rounded-r-md border-l-4 border-brand-500 bg-brand-50/50 px-4 py-3 text-ink-2">
                {inline(block.text, key)}
              </blockquote>
            );
          case "code":
            return (
              <pre key={key} className="overflow-x-auto rounded-md border border-line bg-surface-2 p-3 font-mono text-xs leading-6">
                {block.text}
              </pre>
            );
          case "table":
            return (
              <div key={key} className="overflow-x-auto rounded-md border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2 text-xs font-semibold text-ink-2">
                    <tr>
                      {block.head.map((c, n) => (
                        <th key={n} className="min-w-28 px-3 py-2">
                          {inline(c, `${key}-h${n}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {block.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((c, n) => (
                          <td key={n} className="min-w-28 px-3 py-2 align-top">
                            {inline(c, `${key}-${r}-${n}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "rule":
            return <hr key={key} className="border-line" />;
        }
      })}
    </div>
  );
}
