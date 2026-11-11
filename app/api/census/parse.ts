import { unzipSync, strFromU8 } from "fflate";

// Reads Carmen's "HC Census" workbook (one sheet per month, one column per
// day) and returns only the four summary rows she computes at the bottom of
// each sheet: Total Private Pay, Total Medicaid, Total SNF, TOTAL HC.
// Resident rows are never read into the output; nothing with a name on it
// leaves this function.
//
// An .xlsx is a zip of XML. Formula cells carry their last computed value in
// <v>, so the totals are there without evaluating anything.

export type CensusDay = { date: string; total: number; private: number | null; medicaid: number | null; snf: number | null };
export type ParsedSheet = { name: string; month: string | null; days: number; found: string[]; dayColumn: number | null };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// which summary row a label in columns A-D names, if any
const LABELS: { key: "private" | "medicaid" | "snf" | "total"; re: RegExp }[] = [
  { key: "private", re: /^total private\b/ },
  { key: "medicaid", re: /^total medicaid\b/ },
  { key: "snf", re: /^total (snf|skilled)\b/ },
  { key: "total", re: /^total (hc|health ?center|census)\b/ },
];

function decodeXml(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k === "amp") return "&";
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    const code = k.startsWith("#x") ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  });
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return m ? decodeXml(m[1]) : null;
}

// "AB" -> 28 (1-based)
function colIndex(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n;
}

function sharedStrings(xml: string): string[] {
  const out: string[] = [];
  const re = /<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    // phonetic runs repeat the text; leave them out
    const inner = (m[1] || "").replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
    let text = "";
    const tre = /<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g;
    let t: RegExpExecArray | null;
    while ((t = tre.exec(inner))) text += decodeXml(t[1] || "");
    out.push(text);
  }
  return out;
}

type Cell = { col: number; num: number | null; str: string | null };

function readRows(xml: string, strings: string[]): Cell[][] {
  const rows: Cell[][] = [];
  const rowRe = /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(xml))) {
    const body = m[1];
    if (!body) continue;
    const cells: Cell[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let c: RegExpExecArray | null;
    while ((c = cellRe.exec(body))) {
      const ref = attr(c[1], "r");
      if (!ref) continue;
      const type = attr(c[1], "t");
      const inner = c[2] || "";
      const v = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
      let num: number | null = null;
      let str: string | null = null;
      if (type === "s") {
        if (v) str = strings[Number(v[1])] ?? null;
      } else if (type === "inlineStr") {
        const t = inner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
        if (t) str = decodeXml(t[1]);
      } else if (type === "str") {
        if (v) str = decodeXml(v[1]);
      } else if (type !== "b" && type !== "e" && v) {
        const n = Number(v[1]);
        if (Number.isFinite(n)) num = n;
      }
      if (num !== null || str !== null) cells.push({ col: colIndex(ref.replace(/[^A-Z]/g, "")), num, str });
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

// "Nov 2026", "November 2026", "Sept. 2026" -> { y: 2026, m: 11 }
function monthOf(sheetName: string): { y: number; m: number } | null {
  const m = sheetName.trim().match(/^([a-z]{3})[a-z]*\.?\s+(\d{4})$/i);
  if (!m) return null;
  const idx = MONTHS.indexOf(m[1].toLowerCase());
  return idx < 0 ? null : { y: Number(m[2]), m: idx + 1 };
}

const pad = (n: number) => String(n).padStart(2, "0");

// The header band runs 1, 2, 3 ... across the day columns. Find where day 1 sits.
function findDayColumn(rows: Cell[][]): number | null {
  for (const cells of rows) {
    const byCol = new Map<number, number>();
    for (const c of cells) if (c.num !== null) byCol.set(c.col, c.num);
    for (const c of cells) {
      if (c.num !== 1) continue;
      let ok = true;
      for (let d = 2; d <= 28; d++) if (byCol.get(c.col + d - 1) !== d) { ok = false; break; }
      if (ok) return c.col;
    }
  }
  return null;
}

/**
 * @param bytes  the .xlsx file
 * @param cutoff YYYY-MM-DD, the day the report was sent. Carmen pre-fills the
 *               rest of the month, so later days are projections, not census.
 */
export function parseCensusWorkbook(bytes: Uint8Array, cutoff: string): { days: CensusDay[]; sheets: ParsedSheet[] } {
  const files = unzipSync(bytes, {
    filter: (f) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(f.name),
  });
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : "");

  const strings = sharedStrings(text("xl/sharedStrings.xml"));

  const rels: Record<string, string> = {};
  const relRe = /<Relationship\b[^>]*>/g;
  let m: RegExpExecArray | null;
  const relsXml = text("xl/_rels/workbook.xml.rels");
  while ((m = relRe.exec(relsXml))) {
    const id = attr(m[0], "Id");
    const target = attr(m[0], "Target");
    if (id && target) rels[id] = "xl/" + target.replace(/^\/?(xl\/)?/, "");
  }

  const days: CensusDay[] = [];
  const sheets: ParsedSheet[] = [];
  const sheetRe = /<sheet\b[^>]*>/g;
  const wbXml = text("xl/workbook.xml");
  while ((m = sheetRe.exec(wbXml))) {
    const name = attr(m[0], "name") || "";
    const rid = attr(m[0], "r:id") || "";
    const ym = monthOf(name);
    const xml = text(rels[rid] || "");
    const info: ParsedSheet = { name, month: ym ? `${ym.y}-${pad(ym.m)}` : null, days: 0, found: [], dayColumn: null };
    sheets.push(info);
    if (!ym || !xml) continue;

    const rows = readRows(xml, strings);
    const day1 = findDayColumn(rows) ?? 5; // column E when the header can't be found
    info.dayColumn = day1;

    // last matching row wins: the summary block sits at the bottom of the sheet
    const summary: Partial<Record<"private" | "medicaid" | "snf" | "total", Map<number, number>>> = {};
    for (const cells of rows) {
      const label = cells.filter((c) => c.col <= 4 && c.str).map((c) => c.str).join(" ").toLowerCase().replace(/\s+/g, " ").trim();
      if (!label.startsWith("total")) continue;
      const hit = LABELS.find((l) => l.re.test(label));
      if (!hit) continue;
      const byCol = new Map<number, number>();
      for (const c of cells) if (c.num !== null) byCol.set(c.col, c.num);
      summary[hit.key] = byCol;
    }
    info.found = Object.keys(summary);
    if (!summary.total) continue;

    const daysInMonth = new Date(ym.y, ym.m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${ym.y}-${pad(ym.m)}-${pad(d)}`;
      if (date > cutoff) break;
      const col = day1 + d - 1;
      const total = summary.total.get(col);
      if (typeof total !== "number" || total <= 0) continue;
      const pick = (k: "private" | "medicaid" | "snf") => {
        const v = summary[k]?.get(col);
        return typeof v === "number" ? v : null;
      };
      days.push({ date, total, private: pick("private"), medicaid: pick("medicaid"), snf: pick("snf") });
      info.days++;
    }
  }

  days.sort((a, b) => a.date.localeCompare(b.date));
  return { days, sheets };
}
