import { ImageResponse } from "next/og";
import type { CensusDay } from "./parse";
import { PLEX_MONO_500, PLEX_SANS_600 } from "./fonts";

// The census graph for the daily email, drawn here and sent as a PNG.
//
// Mail programs do not run scripts and most will not show an SVG, so the
// tracker's graph cannot be reused as it is. This draws the same sheet (date
// band, tinted weekends, one pen line, the last value named at the end) as a
// still picture. It is laid out 400 units wide and drawn at three times that,
// so it stays sharp on a phone and on a wide screen.
//
// next/og lays out text as boxes and takes shapes as an inline <svg>, so the
// lines and tints live in one svg layer and every label is its own box.

const W = 400;
const H = 190;
const K = 3; // pixels per unit

const INK = "#14171C";
const MUTED = "#59616B";
const PEN = "#2456A6";
const RULE = "#D5DCE4";
const RULE_STRONG = "#AEB9C5";
const WEEKEND = "#F4F6F8";
const PAPER = "#FFFFFF";

const BAND = 24; // the date band across the top
const LEFT = 26;
const RIGHT = 44; // room for the last value, three digits wide
const TOP = BAND + 22;
const BOTTOM = H - 20;

type El = { type: string; props: Record<string, unknown> };
const el = (type: string, props: Record<string, unknown>, children?: unknown): El => ({
  type,
  props: children === undefined ? props : { ...props, children },
});

const utc = (date: string) => new Date(`${date}T12:00:00Z`);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDay = (date: string) => `${MONTHS[utc(date).getUTCMonth()]} ${utc(date).getUTCDate()}`;

// the high and the low of the span; the newest day wins a tie, so a level
// stretch is named once at its near end
export function extremes(series: CensusDay[]): { high: CensusDay; low: CensusDay } | null {
  if (!series.length) return null;
  let high = series[0];
  let low = series[0];
  for (const d of series) {
    if (d.total >= high.total) high = d;
    if (d.total <= low.total) low = d;
  }
  return { high, low };
}

// what the picture shows, for anyone who cannot see it
export function chartAlt(series: CensusDay[]): string {
  const x = extremes(series);
  if (!x) return "";
  const last = series[series.length - 1];
  return `Line graph of the Health Center census, ${shortDay(series[0].date)} to ${shortDay(last.date)}. Low of ${x.low.total} on ${shortDay(x.low.date)}, high of ${x.high.total} on ${shortDay(x.high.date)}, ${last.total} on ${shortDay(last.date)}.`;
}

function draw(series: CensusDay[]): El {
  const n = series.length;
  const cw = (W - LEFT - RIGHT) / n;
  const colX = (i: number) => LEFT + cw * i;
  const x = (i: number) => colX(i) + cw / 2;

  const totals = series.map((d) => d.total);
  let lo = Math.min(...totals) - 1;
  let hi = Math.max(...totals) + 1;
  // never finer than six residents to the sheet, so a change of one stays a small step
  while (hi - lo < 6) { hi++; if (hi - lo < 6) lo--; }
  const y = (v: number) => BOTTOM - ((v - lo) / (hi - lo)) * (BOTTOM - TOP);

  const shapes: El[] = [];
  const labels: El[] = [];
  const r2 = (v: number) => Math.round(v * 100) / 100;

  const text = (
    s: string,
    at: { left?: number; right?: number; center?: number; top: number },
    style: { size: number; color: string; mono?: boolean }
  ) => {
    const box = 80;
    const left = at.center !== undefined ? at.center - box / 2 : at.right !== undefined ? at.right - box : at.left!;
    labels.push(
      el(
        "div",
        {
          style: {
            position: "absolute",
            left: left * K,
            top: at.top * K,
            width: box * K,
            display: "flex",
            justifyContent: at.center !== undefined ? "center" : at.right !== undefined ? "flex-end" : "flex-start",
            fontFamily: style.mono ? "Plex Mono" : "Plex Sans",
            fontSize: style.size * K,
            lineHeight: 1,
            color: style.color,
            whiteSpace: "nowrap",
          },
        },
        s
      )
    );
  };

  // weekends, tinted from under the band to the foot of the sheet
  series.forEach((d, i) => {
    const wd = utc(d.date).getUTCDay();
    if (wd === 0 || wd === 6) shapes.push(el("rect", { x: r2(colX(i)), y: BAND, width: r2(cw), height: H - BAND, fill: WEEKEND }));
  });

  // level lines, named in the left margin
  const span = hi - lo;
  const step = span > 24 ? 10 : span >= 8 ? 5 : 2;
  for (let v = Math.ceil((lo + 0.5) / step) * step; v < hi; v += step) {
    shapes.push(el("line", { x1: LEFT, x2: W - RIGHT, y1: r2(y(v)), y2: r2(y(v)), stroke: RULE, strokeWidth: 1 }));
    text(String(v), { right: LEFT - 6, top: y(v) - 6 }, { size: 11.5, color: MUTED, mono: true });
  }

  // the date band: a rule at each Monday with its date beside it, the month
  // named on the first one and whenever it changes
  let month = -1;
  series.forEach((d, i) => {
    const date = utc(d.date);
    if (date.getUTCDay() !== 1) return;
    const edge = r2(colX(i));
    if (i > 0) shapes.push(el("line", { x1: edge, x2: edge, y1: BAND - 9, y2: H, stroke: RULE, strokeWidth: 1 }));
    // not enough room for a date in the last column
    if (i > n - 2) return;
    const m = date.getUTCMonth();
    text(m !== month ? `${MONTHS[m]} ${date.getUTCDate()}` : String(date.getUTCDate()), { left: edge + 4, top: 6 }, { size: 11.5, color: m !== month ? INK : MUTED, mono: true });
    month = m;
  });

  // frame: the band's rules and the foot
  shapes.push(el("line", { x1: 0, x2: W, y1: 0.75, y2: 0.75, stroke: INK, strokeWidth: 1.5 }));
  shapes.push(el("line", { x1: 0, x2: W, y1: BAND, y2: BAND, stroke: RULE_STRONG, strokeWidth: 1 }));
  shapes.push(el("line", { x1: 0, x2: W, y1: H - 0.5, y2: H - 0.5, stroke: RULE_STRONG, strokeWidth: 1 }));

  // the pen line
  shapes.push(
    el("polyline", {
      points: series.map((d, i) => `${r2(x(i))},${r2(y(d.total))}`).join(" "),
      fill: "none",
      stroke: PEN,
      strokeWidth: 2.25,
      strokeLinejoin: "round",
      strokeLinecap: "round",
    })
  );

  // the high and the low, once each, unless the last day is one of them
  const last = series[n - 1];
  const xs = extremes(series)!;
  const mark = (d: CensusDay, above: boolean) => {
    const i = series.indexOf(d);
    if (i >= n - 3) return; // the end value already says it
    shapes.push(el("circle", { cx: r2(x(i)), cy: r2(y(d.total)), r: 2.6, fill: PAPER, stroke: PEN, strokeWidth: 1.5 }));
    const cx = Math.min(Math.max(x(i), LEFT + 10), W - RIGHT - 10);
    text(String(d.total), { center: cx, top: above ? y(d.total) - 17 : y(d.total) + 7 }, { size: 11.5, color: INK, mono: true });
  };
  if (xs.high.total !== xs.low.total) {
    mark(xs.high, true);
    mark(xs.low, false);
  }

  // the newest day: a ringed dot and its count, in the right margin
  const ex = x(n - 1);
  const ey = y(last.total);
  shapes.push(el("circle", { cx: r2(ex), cy: r2(ey), r: 6, fill: PAPER }));
  shapes.push(el("circle", { cx: r2(ex), cy: r2(ey), r: 4, fill: PEN }));
  text(String(last.total), { left: ex + 9, top: ey - 9.5 }, { size: 18, color: INK });

  return el(
    "div",
    { style: { position: "relative", display: "flex", width: W * K, height: H * K, backgroundColor: PAPER } },
    [
      el("svg", { width: W * K, height: H * K, viewBox: `0 0 ${W} ${H}`, style: { position: "absolute", left: 0, top: 0 } }, shapes),
      ...labels,
    ]
  );
}

export const CHART_SIZE = { width: W * K, height: H * K };

// null when there is nothing to draw or the drawing fails; the email still goes
// out with its numbers
export async function censusChartPng(series: CensusDay[]): Promise<Uint8Array | null> {
  if (series.length < 2) return null;
  try {
    const res = new ImageResponse(draw(series) as never, {
      width: W * K,
      height: H * K,
      fonts: [
        { name: "Plex Sans", data: Buffer.from(PLEX_SANS_600, "base64"), weight: 600, style: "normal" },
        { name: "Plex Mono", data: Buffer.from(PLEX_MONO_500, "base64"), weight: 500, style: "normal" },
      ],
    });
    const png = new Uint8Array(await res.arrayBuffer());
    // a PNG starts with these four bytes; anything else is an error page
    return png.length > 8 && png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47 ? png : null;
  } catch (e) {
    console.error("census chart", e);
    return null;
  }
}
