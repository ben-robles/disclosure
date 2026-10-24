import { formatCost, lookupCost, COST_TABLE_META } from "./costs";
import { worstEnd, GRADING_RULE, LETTER_WORD, LETTERS, needsPro, overallGrade, URGENCY_LABEL, type Letter } from "./grading";
import { JURISDICTION, MD_SECTIONS, sectionNumber } from "./jurisdiction";
import { DISCLAIMER, viewFinding, type Session } from "./store";

export function buildReport(session: Session) {
  const items = session.photos
    .filter((p) => p.confirmed && p.result)
    .map((p) => {
      const f = viewFinding(p);
      return { photo: p, ...f, cost: lookupCost(f.type, f.severity), section: MD_SECTIONS[f.type] };
    });
  const sections = new Map<string, typeof items>();
  for (const it of items) sections.set(it.section, [...(sections.get(it.section) ?? []), it]);
  return { items, sections: [...sections.entries()].sort((a, b) => sectionNumber(a[0]) - sectionNumber(b[0])), overall: overallGrade(items.map((i) => i.range)) };
}

/** Sum of the low and high ends over findings that have a cost estimate; null if none do. */
export function totalCost(items: { cost: { low: number; high: number } | null }[]) {
  const priced = items.filter((i) => i.cost);
  if (!priced.length) return null;
  return {
    low: priced.reduce((n, i) => n + i.cost!.low, 0),
    high: priced.reduce((n, i) => n + i.cost!.high, 0),
  };
}

// ---------------------------------------------------------------------------
// PDF. Same look as the app: Work Sans, the app's blue, its grade colors and
// its logo. Values below are the sRGB equivalents of the oklch tokens in
// styles.css (--foreground, --primary, --muted-foreground, --border, --muted,
// --grade-a..f). Keep them in sync with that file.
// ---------------------------------------------------------------------------
type RGB = [number, number, number];
const INK: RGB = [14, 27, 45];
const BLUE: RGB = [19, 81, 166];
const MUTED: RGB = [80, 89, 102];
const SOFT: RGB = [98, 107, 120];
const RULE: RGB = [221, 226, 230];
const TINT: RGB = [237, 240, 244];
const WHITE: RGB = [255, 255, 255];
const GRADE_FILL: Record<Letter, RGB> = {
  A: [36, 144, 87],
  B: [124, 157, 48],
  C: [240, 187, 59],
  D: [238, 122, 31],
  F: [208, 29, 33],
};
/** Text colour that stays readable on each grade fill (same as GRADE_INK in RiskViz). */
const GRADE_INK: Record<Letter, RGB> = {
  A: WHITE,
  B: [29, 42, 0],
  C: [43, 29, 0],
  D: [43, 19, 0],
  F: WHITE,
};
const fade = (c: RGB, a: number): RGB => c.map((v) => Math.round(v * a + 255 * (1 - a))) as RGB;
const range$ = (r: { low: number; high: number } | null) => formatCost(r);

type Weight = "r" | "s" | "b" | "x";
const FONT_FILES: Record<Weight, { family: string; file: string }> = {
  r: { family: "WorkSans", file: "WorkSans-Regular.ttf" },
  s: { family: "WorkSans-SemiBold", file: "WorkSans-SemiBold.ttf" },
  b: { family: "WorkSans-Bold", file: "WorkSans-Bold.ttf" },
  x: { family: "WorkSans-ExtraBold", file: "WorkSans-ExtraBold.ttf" },
};

/** Embed Work Sans (public/fonts). Returns false if it can't load, and the PDF falls back to Helvetica. */
async function loadFonts(doc: import("jspdf").jsPDF): Promise<boolean> {
  try {
    const base = import.meta.env?.BASE_URL ?? "/";
    for (const { family, file } of Object.values(FONT_FILES)) {
      const res = await fetch(`${base}fonts/${file}`);
      if (!res.ok) return false;
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      doc.addFileToVFS(file, btoa(bin));
      doc.addFont(file, family, "normal");
    }
    return true;
  } catch {
    return false;
  }
}

export async function generatePdf(session: Session): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const { sections, overall, items: captured } = buildReport(session);
  // Same order everywhere: by form section, so table row N is "Finding N".
  const items = sections.flatMap(([, list]) => list);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const customFonts = await loadFonts(doc);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 42;
  const CW = W - M * 2;
  const TOP = 39;
  const BOTTOM = H - 62;
  const TRACK = 0.7;
  let y = 0;

  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const font = (size: number, w: Weight = "r", color: RGB = INK) => {
    if (customFonts) doc.setFont(FONT_FILES[w].family, "normal");
    else doc.setFont("helvetica", w === "r" ? "normal" : "bold");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };
  const wrap = (s: string, w: number): string[] => doc.splitTextToSize(s, w);
  const clip = (s: string, w: number) => wrap(s, w)[0] ?? "";
  const hline = (yy: number, color: RGB, width: number, x1 = M, x2 = W - M) => {
    stroke(color);
    doc.setLineWidth(width);
    doc.line(x1, yy, x2, yy);
  };

  /** Small uppercase label with letter-spacing, like the app's section labels. */
  const label = (s: string, x: number, yy: number, color: RGB = MUTED, size = 7.1, align: "left" | "right" = "left") => {
    const t = s.toUpperCase();
    font(size, "s", color);
    const w = doc.getTextWidth(t) + TRACK * t.length;
    doc.text(t, align === "right" ? x - w : x, yy, { charSpace: TRACK });
    return w;
  };

  /** The app's logo (AppShell Logo): rounded blue square, house outline, check. */
  const logo = (x: number, top: number, s: number) => {
    const k = s / 32;
    fill(BLUE);
    doc.roundedRect(x, top, s, s, 10 * k, 10 * k, "F");
    stroke(WHITE);
    doc.setLineWidth(2.2 * k);
    doc.setLineCap("round");
    doc.setLineJoin("round");
    const poly = (pts: [number, number][], closed: boolean) => {
      const rel = pts.slice(1).map((p, i) => [(p[0] - pts[i]![0]) * k, (p[1] - pts[i]![1]) * k]);
      doc.lines(rel, x + pts[0]![0] * k, top + pts[0]![1] * k, [1, 1], "S", closed);
    };
    poly([[7, 15], [16, 7.5], [25, 15], [25, 24.5], [7, 24.5]], true);
    poly([[12.2, 16.6], [15, 19.4], [20, 14.4]], false);
    doc.setLineCap("butt");
    doc.setLineJoin("miter");
  };

  /** Page header: logo + "Disclosure" wordmark on the left, running label on the right. Returns the rule's y. */
  const header = (logoSize: number, nameSize: number, right: string, ruleW: number) => {
    logo(M, TOP, logoSize);
    font(nameSize, "x");
    doc.text("Disclosure", M + logoSize + 7.5, TOP + logoSize / 2, { baseline: "middle" });
    label(right, W - M, TOP + logoSize / 2 + 2.5, MUTED, 7.5, "right");
    const ruleY = TOP + logoSize + (logoSize > 20 ? 12 : 9);
    hline(ruleY, INK, ruleW);
    return ruleY;
  };
  const newPage = () => {
    doc.addPage();
    return header(16.5, 11.25, "Seller Defect Documentation", 0.75);
  };

  /** Filled grade tile(s): one per letter in the range, in the app's grade colors. Returns the width used. */
  const tiles = (x: number, top: number, size: number, range: Letter[] | null) => {
    if (!range) {
      font(size * 0.3, "s", MUTED);
      const w = doc.getTextWidth("Can't grade") + size * 0.5;
      fill(RULE);
      doc.roundedRect(x, top, w, size, 3, 3, "F");
      doc.text("Can't grade", x + w / 2, top + size / 2, { align: "center", baseline: "middle" });
      return w;
    }
    let cx = x;
    for (const l of range) {
      fill(GRADE_FILL[l]);
      doc.roundedRect(cx, top, size, size, 3, 3, "F");
      font(size * 0.58, "x", GRADE_INK[l]);
      doc.text(l, cx + size / 2, top + size / 2, { align: "center", baseline: "middle" });
      cx += size + 2;
    }
    return cx - x - 2;
  };

  // ---- Cover ----
  y = header(23, 16, "Property Condition Report", 1.5);

  label("Companion report", M, y + 38, BLUE, 7.9);
  let h1 = 33;
  font(h1, "x");
  while (doc.getTextWidth("Seller Defect Documentation") > CW && h1 > 20) {
    h1 -= 0.5;
    font(h1, "x");
  }
  doc.text("Seller Defect Documentation", M, y + 38 + 9 + h1 * 0.85);
  font(9.75, "r", MUTED);
  doc.text(`${JURISDICTION.name} ${JURISDICTION.form}`, M, y + 38 + 9 + h1 * 0.85 + 19);
  y = y + 38 + 9 + h1 * 0.85 + 19 + 21;

  // Prepared for / Property / Generated
  const meta: [string, string, boolean][] = [
    ["Prepared for", session.sellerName || "Not provided", !!session.sellerName],
    ["Property", [session.address, session.zip].filter(Boolean).join(", ") || "Not provided", !!(session.address || session.zip)],
    ["Generated", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), true],
  ];
  const colW = CW / 3;
  hline(y, RULE, 0.75);
  meta.forEach(([k, v, given], i) => {
    const x = M + i * colW + (i ? 12 : 0);
    if (i) {
      stroke(RULE);
      doc.setLineWidth(0.75);
      doc.line(M + i * colW, y, M + i * colW, y + 44);
    }
    label(k, x, y + 18, MUTED, 7.1);
    font(9.75, "s", given ? INK : SOFT);
    doc.text(clip(v, colW - 16), x, y + 34);
  });
  y += 44;
  hline(y, RULE, 0.75);

  // Overall grade card
  y += 21;
  const cardH = 135;
  fill(TINT);
  doc.roundedRect(M, y, CW, cardH, 3, 3, "F");
  const tx = M + 18, ty = y + 18, ts = 99;
  const overallColor = overall ? GRADE_FILL[overall] : RULE;
  fill(overallColor);
  doc.roundedRect(tx, ty, ts, ts, 3, 3, "F");
  const tileInk = overall ? GRADE_INK[overall] : MUTED;
  font(57, "x", tileInk);
  doc.text(overall ?? "–", tx + ts / 2, ty + 44, { align: "center", baseline: "middle" });
  {
    const t = (overall ? LETTER_WORD[overall] : "No grade").toUpperCase();
    font(8.25, "s", tileInk);
    const w = doc.getTextWidth(t) + TRACK * t.length;
    fill(overallColor);
    doc.rect(tx + 2, ty + 76, ts - 4, 14, "F");
    doc.setTextColor(tileInk[0], tileInk[1], tileInk[2]);
    doc.text(t, tx + ts / 2 - w / 2, ty + 85, { charSpace: TRACK });
  }

  const rx = tx + ts + 21;
  const rw = M + CW - 18 - rx;
  const cy = y + cardH / 2;
  font(13.5, "b");
  doc.text("Overall grade", rx, cy - 30);
  font(7.9, "r", MUTED);
  doc.text(`${captured.length} confirmed finding${captured.length === 1 ? "" : "s"}`, rx + rw, cy - 30, { align: "right" });
  font(9.4, "r", MUTED);
  doc.text(wrap(GRADING_RULE, rw), rx, cy - 12, { lineHeightFactor: 1.55 });
  const cellW = (rw - 4 * 3) / 5;
  LETTERS.forEach((l, i) => {
    const on = overall === l;
    fill(on ? GRADE_FILL[l] : fade(GRADE_FILL[l], 0.2));
    doc.roundedRect(rx + i * (cellW + 3), cy + 14, cellW, 18, 2.5, 2.5, "F");
    font(8.25, on ? "x" : "b", on ? GRADE_INK[l] : MUTED);
    doc.text(l, rx + i * (cellW + 3) + cellW / 2, cy + 23, { align: "center", baseline: "middle" });
  });
  y += cardH + 30;

  // Summary table
  font(18, "b");
  doc.text("Summary of findings", M, y);
  y += 14;
  const cols = [
    { h: "#", x: M, w: 21 },
    { h: "Finding", x: M + 21, w: 135 },
    { h: "Form section", x: M + 156, w: 120 },
    { h: "Grade", x: M + 276, w: 62 },
    { h: "Urgency", x: M + 338, w: 85 },
  ];
  const tableHead = () => {
    cols.forEach((c, i) => label(c.h, c.x + (i ? 6 : 0), y + 14));
    label("Est. cost", W - M, y + 14, MUTED, 7.1, "right");
    y += 22;
    hline(y, INK, 0.75);
  };
  tableHead();
  const ROW = 30;
  items.forEach((it, i) => {
    if (y + ROW > BOTTOM) {
      y = newPage() + 20;
      tableHead();
    }
    const base = y + 19;
    font(9, "r", MUTED);
    doc.text(String(i + 1), cols[0]!.x, base);
    font(9, "s");
    doc.text(clip(it.info.label, cols[1]!.w - 10), cols[1]!.x + 6, base);
    font(9, "r", MUTED);
    doc.text(clip(it.section, cols[2]!.w - 10), cols[2]!.x + 6, base);
    tiles(cols[3]!.x + 6, y + 6, 18, it.range);
    font(9, "r");
    doc.text(clip(URGENCY_LABEL[it.urgency], cols[4]!.w - 8), cols[4]!.x + 6, base);
    doc.text(range$(it.cost), W - M, base, { align: "right" });
    y += ROW;
    hline(y, RULE, 0.75);
  });
  if (!items.length) {
    font(9.75, "r", MUTED);
    doc.text("No confirmed findings.", M, y + 19);
    y += ROW;
    hline(y, RULE, 0.75);
  }
  const total = totalCost(items);
  if (total && y + 32 <= BOTTOM) {
    font(9.75, "s");
    doc.text("Total estimated cost", M, y + 20);
    font(10, "b");
    doc.text(range$(total), W - M, y + 20, { align: "right" });
    y += 32;
    hline(y, INK, 1.5);
  }
  if (y + 40 <= BOTTOM) {
    font(7.9, "r", MUTED);
    doc.text(
      wrap(`${COST_TABLE_META.caption} Cost ranges come from a fixed regional table, not a contractor quote. Findings without an estimate are left out of the total.`, 420),
      M,
      y + 16,
      { lineHeightFactor: 1.55 },
    );
  }

  // ---- Findings: one per page, in form-section order ----
  let n = 0;
  for (const [section, list] of sections) {
    for (const it of list) {
      n++;
      y = newPage() + 24;
      const worst = it.range ? worstEnd(it.range) : null;
      const accent: RGB = worst ? GRADE_FILL[worst] : MUTED;

      // Eyebrow, title, grade tiles
      const m = /^(\d+)\.\s*(.*)$/.exec(section);
      label(m ? `Section ${m[1]} · ${m[2]}` : section, M, y + 8, BLUE, 7.9);
      font(25.5, "x");
      const title = wrap(`Finding ${n}: ${it.info.label}`, CW - 130);
      doc.text(title, M, y + 8 + 8 + 20, { lineHeightFactor: 1.1 });
      const titleBottom = y + 8 + 8 + 20 + (title.length - 1) * 28 + 7;
      const tileSize = 36;
      const tilesW = it.range ? it.range.length * tileSize + (it.range.length - 1) * 2 : 80;
      tiles(W - M - tilesW, titleBottom - tileSize, tileSize, it.range);
      if (worst) label(LETTER_WORD[worst], W - M - tilesW - 8, titleBottom - tileSize / 2 + 2.5, MUTED, 7.5, "right");
      y = titleBottom + 15;

      // Photo (aspect-preserving, centered in a bordered frame)
      const fh = 250;
      fill(TINT);
      stroke(RULE);
      doc.setLineWidth(0.75);
      doc.roundedRect(M, y, CW, fh, 3, 3, "FD");
      try {
        const props = doc.getImageProperties(it.photo.dataUrl);
        const k = Math.min((CW - 8) / props.width, (fh - 8) / props.height);
        const iw = props.width * k, ih = props.height * k;
        doc.addImage(it.photo.dataUrl, props.fileType, M + (CW - iw) / 2, y + (fh - ih) / 2, iw, ih);
      } catch {
        font(8.25, "r", MUTED);
        doc.text("Photo unavailable", M + CW / 2, y + fh / 2, { align: "center" });
      }
      y += fh + 18;

      // Severity / Urgency / Estimated cost
      const sh = 62;
      hline(y, INK, 0.75);
      hline(y + sh, RULE, 0.75);
      const c3 = CW / 3;
      stroke(RULE);
      doc.line(M + c3, y, M + c3, y + sh);
      doc.line(M + 2 * c3, y, M + 2 * c3, y + sh);
      label("Severity", M, y + 19);
      for (let s = 0; s < 5; s++) {
        const on = s < it.severity;
        fill(on ? accent : TINT);
        stroke(on ? fade(worst ? GRADE_INK[worst] : INK, 0.35) : RULE);
        doc.setLineWidth(0.5);
        doc.roundedRect(M + s * 12.75, y + 30, 10.5, 10.5, 1.5, 1.5, "FD");
      }
      font(11.25, "s");
      doc.text(`${it.severity} of 5`, M + 5 * 12.75 + 8, y + 39);

      label("Urgency", M + c3 + 12, y + 19);
      const uLabel = URGENCY_LABEL[it.urgency];
      if (it.urgency === "immediate") {
        font(9, "s", WHITE);
        const uw = doc.getTextWidth(uLabel) + 16;
        fill(GRADE_FILL.F);
        doc.roundedRect(M + c3 + 12, y + 27, uw, 17, 8.5, 8.5, "F");
        doc.text(uLabel, M + c3 + 12 + uw / 2, y + 35.5, { align: "center", baseline: "middle" });
      } else {
        font(11.25, "s");
        doc.text(uLabel, M + c3 + 12, y + 39);
      }

      label("Estimated cost", M + 2 * c3 + 12, y + 19);
      font(11.25, "s");
      doc.text(range$(it.cost), M + 2 * c3 + 12, y + 37);
      font(7.5, "r", MUTED);
      doc.text(clip(COST_TABLE_META.caption, c3 - 18), M + 2 * c3 + 12, y + 49);
      y += sh;

      // What the photo shows
      const textX = M + 144;
      label("What the photo shows", M, y + 30);
      font(12, "r");
      const reason = wrap(it.reason, CW - 144);
      doc.text(reason, textX, y + 30, { lineHeightFactor: 1.55 });
      y += 18 + reason.length * 18.6 + 18;
      hline(y, RULE, 0.75);

      // Professional
      const pro = needsPro(it.range);
      label(pro ? "Recommendation" : "Typical professional", M, y + 25);
      font(9.75, "s");
      const rec = pro ? `Recommend evaluation by a licensed ${it.info.pro.toLowerCase()}.` : `${it.info.pro}.`;
      const recLines = wrap(rec, CW - 144);
      doc.text(recLines, textX, y + 25, { lineHeightFactor: 1.5 });
      y += 18 + recLines.length * 14.6 + 10;
      hline(y, RULE, 0.75);
    }
  }

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    hline(H - 48, RULE, 0.75);
    font(7.1, "r", MUTED);
    doc.text(DISCLAIMER, M, H - 34);
    font(7.1, "s", MUTED);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 34, { align: "right" });
  }
  return doc.output("blob");
}
